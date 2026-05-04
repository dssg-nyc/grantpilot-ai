import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
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
    return NextResponse.json({
      data: [],
      pagination: { page: 1, limit: 20, total: 0, has_more: false },
      stats: { total_matches: 0, strong_matches: 0, new_since_last_visit: 0 },
    });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 100);
  const offset = (page - 1) * limit;
  const status = searchParams.get("status");
  const minScore = parseInt(searchParams.get("min_score") ?? "0");

  let query = supabase
    .from("matches")
    .select("*, opportunity:opportunities(*)", { count: "exact" })
    .eq("org_id", userData.org_id)
    .gte("match_score", minScore)
    .order("match_score", { ascending: false });

  if (status) query = query.eq("status", status);
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { count: strongCount } = await supabase
    .from("matches")
    .select("*", { count: "exact", head: true })
    .eq("org_id", userData.org_id)
    .gte("match_score", 70);

  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);
  const { count: newCount } = await supabase
    .from("matches")
    .select("*", { count: "exact", head: true })
    .eq("org_id", userData.org_id)
    .eq("status", "new")
    .gte("created_at", oneDayAgo.toISOString());

  const formatted = (data ?? []).map((row) => ({
    match: {
      id: row.id,
      org_id: row.org_id,
      opportunity_id: row.opportunity_id,
      raw_similarity_score: row.raw_similarity_score,
      match_score: row.match_score,
      success_probability: row.success_probability,
      status: row.status,
      created_at: row.created_at,
    },
    opportunity: row.opportunity,
    match_score: row.match_score,
    success_probability: row.success_probability,
    match_reasons: row.match_reasons ?? [],
    disqualifiers: row.disqualifiers ?? [],
    recommended_action: row.recommended_action,
  }));

  return NextResponse.json({
    data: formatted,
    pagination: { page, limit, total: count ?? 0, has_more: (count ?? 0) > offset + limit },
    stats: { total_matches: count ?? 0, strong_matches: strongCount ?? 0, new_since_last_visit: newCount ?? 0 },
  });
}
