/**
 * GrantPilot background worker — replaces Inngest.
 *
 * Runs as its own long-lived process next to the Next.js server:
 *   tsx worker/index.ts
 * Locally (env from .env.local):
 *   tsx --env-file=.env.local worker/index.ts
 *
 * Starts pg-boss against DATABASE_URL (direct Postgres connection — NOT a
 * transaction-mode pooler), creates every queue from lib/jobs/definitions.ts,
 * registers its handler, and installs the cron schedules (UTC). Cron schedules
 * live in the database; pg-boss ensures only one worker instance sends each
 * tick even if several workers run.
 */
import { PgBoss } from "pg-boss";
import { JOB_DEFINITIONS, type JobName, type JobPayloads } from "@/lib/jobs/definitions";
import { JOB_HANDLERS, type JobContext } from "@/lib/jobs/handlers";

const SHUTDOWN_TIMEOUT_MS = 30_000;

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("[worker] DATABASE_URL is not set");
    process.exit(1);
  }

  const boss = new PgBoss({
    connectionString,
    application_name: "grantpilot-worker",
    instanceName: "worker",
  });
  boss.on("error", (err) => console.error("[worker] pg-boss error", err));
  boss.on("warning", (warning) => console.warn("[worker] pg-boss warning", warning));

  // Retry a few times so the worker survives booting before Postgres is ready
  // (e.g. docker compose bringing both up together).
  await boss.start({ attempts: 5 });

  const ctx: JobContext = {
    // Queues are all created below before any handler runs, so a plain send is safe.
    enqueue: <N extends JobName>(name: N, data: JobPayloads[N]) => boss.send(name, data as object),
  };

  const names = Object.keys(JOB_DEFINITIONS) as JobName[];

  for (const name of names) {
    const def = JOB_DEFINITIONS[name];
    // createQueue is a no-op for an existing queue, so push retry/expiry
    // changes to existing queues too (policy can't be changed after creation).
    await boss.createQueue(name, def.queue);
    const updatable = { ...def.queue };
    delete updatable.policy;
    await boss.updateQueue(name, updatable);
  }

  for (const name of names) {
    const def = JOB_DEFINITIONS[name];
    const handler = JOB_HANDLERS[name] as (data: unknown, ctx: JobContext) => Promise<unknown>;

    await boss.work(name, { batchSize: 1, localConcurrency: def.localConcurrency ?? 1 }, async ([job]) => {
      const started = Date.now();
      console.log(`[worker] ${name} ${job.id} started (attempt ${job.retryCount + 1})`);
      try {
        const result = await handler(job.data, ctx);
        console.log(`[worker] ${name} ${job.id} completed in ${Date.now() - started}ms`, JSON.stringify(result ?? null));
        // Stored as the job's output in pgboss.job — visible via findJobs().
        return result;
      } catch (err) {
        console.error(`[worker] ${name} ${job.id} failed after ${Date.now() - started}ms`, err);
        throw err;
      }
    });
  }

  // Cron triggers (same expressions the Inngest functions used), in UTC.
  // Drop schedules for jobs that no longer have a cron so removing one from
  // definitions.ts actually stops it.
  for (const schedule of await boss.getSchedules()) {
    const def = JOB_DEFINITIONS[schedule.name as JobName];
    if (!def?.cron) await boss.unschedule(schedule.name, schedule.key);
  }
  for (const name of names) {
    const { cron } = JOB_DEFINITIONS[name];
    if (cron) await boss.schedule(name, cron, { triggered_by: "cron" }, { tz: "UTC" });
  }

  console.log(`[worker] ready — ${names.length} queues: ${names.join(", ")}`);

  let stopping = false;
  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    console.log(`[worker] ${signal} received — waiting up to ${SHUTDOWN_TIMEOUT_MS / 1000}s for active jobs`);
    try {
      // Jobs still running when the timeout hits are failed by pg-boss and go
      // through their queue's normal retry policy on the next worker start.
      await boss.stop({ graceful: true, timeout: SHUTDOWN_TIMEOUT_MS });
    } catch (err) {
      console.error("[worker] error during shutdown", err);
    }
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

process.on("unhandledRejection", (err) => console.error("[worker] unhandled rejection", err));

main().catch((err) => {
  console.error("[worker] fatal", err);
  process.exit(1);
});
