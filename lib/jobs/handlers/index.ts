import type { JobName } from "@/lib/jobs/definitions";
import type { JobHandler } from "@/lib/jobs/handlers/types";
import { syncGrantsGov } from "@/lib/jobs/handlers/sync-grants-gov";
import { syncSamGov } from "@/lib/jobs/handlers/sync-sam-gov";
import { monitorRss } from "@/lib/jobs/handlers/monitor-rss";
import { crawlFoundations } from "@/lib/jobs/handlers/crawl-foundations";
import { computeMatchesForNewOpportunities } from "@/lib/jobs/handlers/compute-matches";
import { recomputeOrgMatches } from "@/lib/jobs/handlers/recompute-org-matches";
import { sendDigestEmails } from "@/lib/jobs/handlers/send-digest-emails";
import { updateTrendingScores } from "@/lib/jobs/handlers/update-trending-scores";

/** Worker-only: queue name -> handler. Not imported by the web process. */
export const JOB_HANDLERS: { [N in JobName]: JobHandler<N> } = {
  "grants/sync.requested": syncGrantsGov,
  "sync-sam-gov": syncSamGov,
  "monitor-rss": monitorRss,
  "crawl-foundations": crawlFoundations,
  "grants/new-opportunities": computeMatchesForNewOpportunities,
  "org/profile-updated": recomputeOrgMatches,
  "send-digest-emails": sendDigestEmails,
  "update-trending-scores": updateTrendingScores,
};

export type { JobContext, JobHandler } from "@/lib/jobs/handlers/types";
