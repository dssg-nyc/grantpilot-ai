import { NextResponse } from "next/server";
import { inngest } from "@/inngest/client";
import { rateLimitGuard, strictRateLimiter } from "@/lib/redis/rate-limiter";

// Manual/admin trigger only — no frontend calls this route.
const ALLOWED_JOBS = new Set([
  "grants/sync.requested",
  "grants/new-opportunities",
  "org/profile-updated",
]);

export async function POST(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Defense in depth: even with a leaked secret, cap how often this expensive
  // set of jobs (Firecrawl / Claude / Voyage calls) can be triggered.
  const limited = await rateLimitGuard(request, "agents-trigger", strictRateLimiter);
  if (limited) return limited;

  let body: { job?: string } = {};
  try { body = await request.json(); } catch { /* default to sync-grants-gov */ }

  const job = body.job ?? "grants/sync.requested";

  if (!ALLOWED_JOBS.has(job)) {
    return NextResponse.json({ error: `Unknown job: ${job}` }, { status: 400 });
  }

  await inngest.send({ name: job, data: { triggered_by: "manual", timestamp: new Date().toISOString() } });

  return NextResponse.json({ ok: true, job_triggered: job });
}
