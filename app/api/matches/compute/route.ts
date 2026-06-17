import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { computeMatchRowsForOrg } from "@/lib/matching/compute";
import type { OrgProfile } from "@/types/profile";

async function computeMatchesForOrg(org: Record<string, unknown>) {
  const matchRows = await computeMatchRowsForOrg(org as unknown as OrgProfile & { id: string });

  if (matchRows.length === 0)
    return NextResponse.json({ matched: 0, message: "No similar grants found — grants may need embeddings" });

  const { error } = await supabaseAdmin
    .from("matches")
    .upsert(matchRows, { onConflict: "org_id,opportunity_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ matched: matchRows.length, message: "Matches computed successfully" });
}

export async function GET(request: Request) {
  // Dev/admin trigger: GET /api/matches/compute?org_id=xxx with cron secret
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const orgId = new URL(request.url).searchParams.get("org_id");
  if (!orgId) return NextResponse.json({ error: "org_id required" }, { status: 400 });

  const { data: org } = await supabaseAdmin
    .from("organizations").select("*").eq("id", orgId).single();
  if (!org?.profile_embedding)
    return NextResponse.json({ error: "Profile embedding missing" }, { status: 400 });

  return computeMatchesForOrg(org as Record<string, unknown>);
}

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: userData } = await supabase
    .from("users").select("org_id").eq("id", user.id).single();
  if (!userData?.org_id) return NextResponse.json({ error: "No org" }, { status: 404 });

  const { data: org } = await supabaseAdmin
    .from("organizations").select("*").eq("id", userData.org_id).single();
  if (!org?.profile_embedding)
    return NextResponse.json({ error: "Profile embedding missing — complete your profile first" }, { status: 400 });

  return computeMatchesForOrg(org as Record<string, unknown>);
}
