import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { vectorSimilaritySearch } from "@/lib/matching/vector-search";
import { computeCompositeScore } from "@/lib/matching/score-calculator";
import { batchAnalyzeMatches } from "@/lib/anthropic/match-analyzer";
import type { OrgProfile } from "@/types/profile";
import type { Opportunity } from "@/types/opportunity";

async function computeMatchesForOrg(org: Record<string, unknown>) {
  const topOpps = await vectorSimilaritySearch(org.profile_embedding as unknown as number[], 100);

  if (topOpps.length === 0)
    return NextResponse.json({ matched: 0, message: "No similar grants found — grants may need embeddings" });

  const scored = topOpps
    .map(({ opportunity, similarity }) => ({
      opportunity,
      similarity,
      composite_score: computeCompositeScore(org as unknown as OrgProfile, opportunity, similarity),
    }))
    .filter((o) => o.composite_score >= 25)
    .sort((a, b) => b.composite_score - a.composite_score)
    .slice(0, 20);

  const analyses = await batchAnalyzeMatches(
    org as unknown as OrgProfile,
    scored.map((o) => o.opportunity as unknown as Opportunity),
  );

  const matchRows = scored.map(({ opportunity, similarity, composite_score }) => {
    const analysis = analyses.get(opportunity.id);
    return {
      org_id: org.id,
      opportunity_id: opportunity.id,
      raw_similarity_score: similarity,
      match_score: analysis?.match_score ?? Math.round(composite_score),
      success_probability: analysis?.success_probability ?? 0,
      match_reasons: analysis?.match_reasons ?? [],
      disqualifiers: analysis?.disqualifiers ?? [],
      recommended_action: analysis?.recommended_action ?? "",
      status: "new",
      ai_analysis_at: new Date().toISOString(),
    };
  });

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
