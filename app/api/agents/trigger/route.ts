import { NextResponse } from "next/server";
import { rateLimitGuard, strictRateLimiter } from "@/lib/redis/rate-limiter";
import { enqueue } from "@/lib/jobs/queue";
import { isJobName } from "@/lib/jobs/definitions";

// Manual/admin trigger only — no frontend calls this route. Any job in
// lib/jobs/definitions.ts can be run on demand.

export async function POST(request: Request) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (process.env.NODE_ENV === "production" && (!secret || auth !== `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Defense in depth: even with a leaked secret, cap how often this expensive
  // set of jobs (scraping / Claude / embedding calls) can be triggered.
  const limited = await rateLimitGuard(request, "agents-trigger", strictRateLimiter);
  if (limited) return limited;

  let body: { job?: string; org_id?: string } = {};
  try { body = await request.json(); } catch { /* default to sync-grants-gov */ }

  const job = body.job ?? "grants/sync.requested";

  if (!isJobName(job)) {
    return NextResponse.json({ error: `Unknown job: ${job}` }, { status: 400 });
  }
  if (job === "org/profile-updated" && typeof body.org_id !== "string") {
    return NextResponse.json({ error: "org_id is required for org/profile-updated" }, { status: 400 });
  }

  const meta = { triggered_by: "manual", timestamp: new Date().toISOString() };
  let jobId: string | null;
  try {
    jobId = job === "org/profile-updated"
      ? await enqueue(job, { ...meta, org_id: body.org_id as string })
      : await enqueue(job, meta);
  } catch (e) {
    console.error("agents/trigger: enqueue failed", e);
    return NextResponse.json({ error: "Could not queue job" }, { status: 503 });
  }

  // job_id is null when the queue dropped it because the same job is already queued.
  return NextResponse.json({ ok: true, job_triggered: job, job_id: jobId });
}
