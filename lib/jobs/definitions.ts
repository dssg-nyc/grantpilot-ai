import type { Queue } from "pg-boss";

/**
 * Single registry of every background job: queue name, payload shape, queue
 * policy/retry config, and (for scheduled jobs) the cron trigger.
 *
 * Deliberately free of handler imports so the Next web process can import it
 * (via lib/jobs/queue.ts) without pulling in Anthropic/Resend/scraper code —
 * only the worker process (worker/index.ts) loads lib/jobs/handlers.
 *
 * Queue names keep the old Inngest event names where callers send them
 * ("grants/sync.requested", "grants/new-opportunities", "org/profile-updated");
 * cron-only jobs use the old Inngest function id.
 */
export const JOBS = {
  syncGrantsGov: "grants/sync.requested",
  syncSamGov: "sync-sam-gov",
  monitorRss: "monitor-rss",
  crawlFoundations: "crawl-foundations",
  computeMatches: "grants/new-opportunities",
  recomputeOrgMatches: "org/profile-updated",
  sendDigestEmails: "send-digest-emails",
  updateTrendingScores: "update-trending-scores",
} as const;

export type JobName = (typeof JOBS)[keyof typeof JOBS];

/** Common fields manual/admin triggers attach; handlers ignore them. */
interface TriggerMeta {
  triggered_by?: string;
  timestamp?: string;
}

export interface JobPayloads {
  "grants/sync.requested": TriggerMeta;
  "sync-sam-gov": TriggerMeta;
  "monitor-rss": TriggerMeta;
  "crawl-foundations": TriggerMeta;
  "grants/new-opportunities": TriggerMeta & { count?: number; source?: string };
  "org/profile-updated": TriggerMeta & { org_id: string };
  "send-digest-emails": TriggerMeta;
  "update-trending-scores": TriggerMeta;
}

export interface JobDefinition {
  /** Queue options passed to boss.createQueue (policy, retries, expiry). */
  queue: Omit<Queue, "name">;
  /** Cron expression (UTC) — same triggers the Inngest functions used. */
  cron?: string;
  /** Jobs this worker process runs in parallel for the queue. */
  localConcurrency?: number;
}

const MINUTE = 60;
const HOUR = 60 * MINUTE;

// Inngest `concurrency: { limit: 1 }` maps to the "stately" policy: at most one
// job active AND at most one queued. A cron tick or extra trigger that lands
// while a run is already queued is dropped instead of piling up — every one of
// these jobs re-scans its whole source, so a second queued run is redundant.
//
// Retries restart the whole handler (there's no per-step memoization like
// Inngest's step.run), which is safe because every handler upserts by a
// natural key (source+source_id, org_id+opportunity_id).
export const JOB_DEFINITIONS: Record<JobName, JobDefinition> = {
  "grants/sync.requested": {
    cron: "0 */4 * * *",
    // Pages through every grants.gov result with detail fetch + embed + AI per opp.
    queue: { policy: "stately", retryLimit: 2, retryDelay: 5 * MINUTE, retryBackoff: true, expireInSeconds: 4 * HOUR },
  },
  "sync-sam-gov": {
    cron: "0 2 * * *",
    queue: { policy: "stately", retryLimit: 2, retryDelay: 5 * MINUTE, retryBackoff: true, expireInSeconds: HOUR },
  },
  "monitor-rss": {
    cron: "0 */4 * * *",
    queue: { policy: "stately", retryLimit: 2, retryDelay: 5 * MINUTE, retryBackoff: true, expireInSeconds: HOUR },
  },
  "crawl-foundations": {
    cron: "0 6 * * *",
    queue: { policy: "stately", retryLimit: 2, retryDelay: 5 * MINUTE, retryBackoff: true, expireInSeconds: 2 * HOUR },
  },
  "grants/new-opportunities": {
    // Bursts of "new opportunities" signals (one per sync / user import)
    // coalesce into a single queued recompute across all orgs.
    queue: { policy: "stately", retryLimit: 2, retryDelay: 2 * MINUTE, retryBackoff: true, expireInSeconds: 2 * HOUR },
  },
  "org/profile-updated": {
    // Inngest ran this with concurrency 3. "stately" + singletonKey = org_id
    // (see lib/jobs/queue.ts) keeps one active + one queued recompute per org,
    // so rapid profile saves coalesce while different orgs run in parallel.
    queue: { policy: "stately", retryLimit: 3, retryDelay: 30, retryBackoff: true, expireInSeconds: 15 * MINUTE },
    localConcurrency: 3,
  },
  "send-digest-emails": {
    cron: "0 9 * * 1",
    // Per-subscriber send failures are caught inside the handler, so a retry
    // only happens when the run fails before any email went out.
    queue: { policy: "stately", retryLimit: 2, retryDelay: 5 * MINUTE, expireInSeconds: HOUR },
  },
  "update-trending-scores": {
    cron: "0 * * * *",
    queue: { policy: "stately", retryLimit: 1, retryDelay: MINUTE, expireInSeconds: 30 * MINUTE },
  },
};

export function isJobName(name: string): name is JobName {
  return Object.prototype.hasOwnProperty.call(JOB_DEFINITIONS, name);
}
