import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getPlanLimits } from "@/lib/billing/plans";

async function getOrgId() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("users").select("org_id").eq("id", user.id).single();
  return data?.org_id ?? null;
}

export async function GET() {
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Unauthorized or no org" }, { status: 401 });

  const { data: org, error } = await supabaseAdmin
    .from("organizations")
    .select("plan")
    .eq("id", orgId)
    .single();

  if (error || !org) {
    return NextResponse.json({ error: error?.message ?? "Organization not found" }, { status: 500 });
  }

  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

  const [pipelineCount, draftsCount, matchesCount] = await Promise.all([
    supabaseAdmin
      .from("pipeline_items")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .is("deleted_at", null),
    supabaseAdmin
      .from("draft_generations")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .gte("created_at", startOfMonth),
    supabaseAdmin
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId),
  ]);

  return NextResponse.json({
    plan: org.plan,
    limits: getPlanLimits(org.plan),
    usage: {
      activePipelineItems: pipelineCount.count ?? 0,
      aiDraftsThisMonth: draftsCount.count ?? 0,
      totalMatches: matchesCount.count ?? 0,
    },
  });
}
