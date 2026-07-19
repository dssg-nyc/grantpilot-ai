import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { rateLimitGuard, strictRateLimiter } from "@/lib/redis/rate-limiter";
import { importOpportunityFromUrl } from "@/lib/opportunities/import-from-url";
import type { Opportunity } from "@/types/opportunity";

async function getOrgId() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, orgId: null };
  const { data } = await supabase.from("users").select("org_id").eq("id", user.id).maybeSingle();
  return { supabase, orgId: data?.org_id ?? null };
}

export async function POST(request: Request) {
  const limited = await rateLimitGuard(request, "opportunity-submit", strictRateLimiter);
  if (limited) return limited;

  const { supabase, orgId } = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Unauthorized or no org" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const url = typeof body.url === "string" ? body.url : "";
  const funderName = typeof body.funder_name === "string" ? body.funder_name : "";
  const funderType =
    typeof body.funder_type === "string" ? (body.funder_type as Opportunity["funder_type"]) : undefined;
  const geographicStates = Array.isArray(body.geographic_states)
    ? (body.geographic_states as string[])
    : undefined;

  const result = await importOpportunityFromUrl({
    url,
    funderName,
    funderType,
    geographicStates,
    orgId,
    orgSupabase: supabase,
  });

  if ("error" in result) {
    const message =
      result.status === 422
        ? `${result.error} Try adding it manually instead.`
        : result.error;
    return NextResponse.json({ error: message }, { status: result.status });
  }

  return NextResponse.json(
    { opportunity: result.opportunity, pipeline_item: result.pipelineItem, plan_limited: result.planLimited },
    { status: 200 },
  );
}
