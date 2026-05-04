import { NextResponse } from "next/server";
import { inngest } from "@/inngest/client";
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

  const event = await inngest.send({
    name: "org/profile-updated",
    data: { org_id: userData.org_id },
  });

  return NextResponse.json(
    { job_id: event.ids?.[0] ?? crypto.randomUUID(), message: "Match refresh queued" },
    { status: 202 },
  );
}
