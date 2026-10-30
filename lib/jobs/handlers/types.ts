import type { JobName, JobPayloads } from "@/lib/jobs/definitions";

/**
 * What a handler gets besides its payload. `enqueue` is backed by the worker's
 * own PgBoss instance (not lib/jobs/queue.ts) so a job can fan out follow-up
 * jobs — the replacement for Inngest's step.sendEvent.
 */
export interface JobContext {
  enqueue<N extends JobName>(name: N, data: JobPayloads[N]): Promise<string | null>;
}

export type JobHandler<N extends JobName> = (data: JobPayloads[N], ctx: JobContext) => Promise<unknown>;
