import { PgBoss, type SendOptions } from "pg-boss";
import { JOB_DEFINITIONS, type JobName, type JobPayloads } from "@/lib/jobs/definitions";

/**
 * Send-only pg-boss client for the Next.js web process. Jobs are executed by
 * the separate worker process (worker/index.ts); this instance never calls
 * work(), never runs cron scheduling, and never runs queue maintenance.
 *
 * Node runtime only — pg-boss talks to Postgres over TCP via `pg`.
 */

// Survive Next dev hot reloads without leaking a new pool per reload.
const globalForBoss = globalThis as unknown as {
  __pgBossSender?: Promise<PgBoss>;
  __pgBossQueuesReady?: Set<string>;
};

function startSender(): Promise<PgBoss> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return Promise.reject(new Error("DATABASE_URL is not set — cannot enqueue background jobs"));
  }

  const boss = new PgBoss({
    connectionString,
    application_name: "grantpilot-web",
    max: 3,
    schedule: false,
    supervise: false,
    registerInstance: false,
  });
  // pg-boss is an EventEmitter — an unhandled 'error' event would crash the server.
  boss.on("error", (err) => console.error("[jobs] pg-boss error", err));

  return boss.start();
}

async function getSender(): Promise<PgBoss> {
  if (!globalForBoss.__pgBossSender) {
    globalForBoss.__pgBossSender = startSender().catch((err) => {
      // Don't cache a failed start — let the next request retry.
      globalForBoss.__pgBossSender = undefined;
      throw err;
    });
  }
  return globalForBoss.__pgBossSender;
}

// The worker creates every queue on boot, but the web process may enqueue
// before the worker has ever run against this database. createQueue is
// idempotent (ON CONFLICT DO NOTHING), so ensure each queue once per process.
async function ensureQueue(boss: PgBoss, name: JobName) {
  const ready = (globalForBoss.__pgBossQueuesReady ??= new Set());
  if (ready.has(name)) return;
  await boss.createQueue(name, JOB_DEFINITIONS[name].queue);
  ready.add(name);
}

function defaultSendOptions<N extends JobName>(name: N, data: JobPayloads[N]): SendOptions {
  // One active + one queued recompute per org (queue policy is "stately").
  if (name === "org/profile-updated") {
    return { singletonKey: (data as JobPayloads["org/profile-updated"]).org_id };
  }
  return {};
}

/**
 * Enqueue a background job. Resolves to the job id, or null when the queue's
 * policy dropped it because an equivalent job is already queued (expected —
 * that run will pick up the same work).
 */
export async function enqueue<N extends JobName>(
  name: N,
  data: JobPayloads[N],
  opts: SendOptions = {},
): Promise<string | null> {
  const boss = await getSender();
  await ensureQueue(boss, name);
  return boss.send(name, data as object, { ...defaultSendOptions(name, data), ...opts });
}
