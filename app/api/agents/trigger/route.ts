import { NextResponse } from "next/server";
import { inngest } from "@/inngest/client";

export async function POST(request: Request) {
  let body: { job?: string } = {};
  try { body = await request.json(); } catch { /* default to sync-grants-gov */ }

  const job = body.job ?? "grants/sync.requested";

  await inngest.send({ name: job, data: { triggered_by: "manual", timestamp: new Date().toISOString() } });

  return NextResponse.json({ ok: true, job_triggered: job });
}
