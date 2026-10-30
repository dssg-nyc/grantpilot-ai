import { NextResponse } from "next/server";
import { enqueue } from "@/lib/jobs/queue";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: userData } = await supabase
    .from("users")
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (!userData?.org_id) {
    return NextResponse.json({ error: "No organization found" }, { status: 404 });
  }

  let jobId: string | null;
  try {
    jobId = await enqueue("org/profile-updated", { org_id: userData.org_id });
  } catch (e) {
    console.error("matches/refresh: enqueue failed", e);
    return NextResponse.json({ error: "Could not queue match refresh" }, { status: 503 });
  }

  // jobId is null when a refresh for this org is already queued — that queued
  // run covers this request, so it's still a success.
  return NextResponse.json(
    { job_id: jobId ?? crypto.randomUUID(), message: "Match refresh queued" },
    { status: 202 },
  );
}
