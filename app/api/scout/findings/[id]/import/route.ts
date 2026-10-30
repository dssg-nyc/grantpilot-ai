import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { rateLimitGuard, strictRateLimiter } from "@/lib/redis/rate-limiter";
import { importOpportunityFromUrl } from "@/lib/opportunities/import-from-url";
import type { Opportunity } from "@/types/opportunity";

/** Page fetch + Claude extraction + embedding — slow, but bounded. */
export const maxDuration = 120;

/**
 * Promotes one scout finding from "unverified web lead" to a real opportunity
 * in the shared, matchable pool, plus a pipeline item for this org.
 *
 * It deliberately re-scrapes the source URL through the same
 * importOpportunityFromUrl path that manual URL submissions and the chat
 * assistant use, rather than copying the agent's own field values across. The
 * agent read that page to judge fit; the importer reads it to produce a
 * canonical, embedded, matchable record. Trusting the agent's summary here
 * would put unverified model output into every other org's match scores.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const limited = await rateLimitGuard(request, "scout-import", strictRateLimiter);
  if (limited) return limited;

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: userRow } = await supabase.from("users").select("org_id").eq("id", user.id).maybeSingle();
  const orgId = userRow?.org_id ?? null;
  if (!orgId) return NextResponse.json({ error: "Complete your organization profile first." }, { status: 400 });

  const { data: finding, error: findingError } = await supabase
    .from("scout_findings")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (findingError) return NextResponse.json({ error: findingError.message }, { status: 500 });
  if (!finding) return NextResponse.json({ error: "Finding not found" }, { status: 404 });

  if (finding.imported_opportunity_id) {
    return NextResponse.json({
      already_imported: true,
      opportunity_id: finding.imported_opportunity_id,
      pipeline_item_id: finding.imported_pipeline_item_id,
    });
  }

  const result = await importOpportunityFromUrl({
    url: finding.application_url ?? finding.source_url,
    funderName: finding.funder_name,
    funderType: finding.funder_type as Opportunity["funder_type"],
    orgId,
    orgSupabase: supabase,
  });

  if ("error" in result) {
    return NextResponse.json(
      {
        error: `Couldn't import this lead automatically: ${result.error} You can still open the source page and add it manually from the Opportunities tab.`,
      },
      { status: result.status },
    );
  }

  const { error: updateError } = await supabase
    .from("scout_findings")
    .update({
      imported_opportunity_id: result.opportunity.id,
      imported_pipeline_item_id: result.pipelineItem?.id ?? null,
    })
    .eq("id", id)
    .eq("org_id", orgId);
  // The import itself succeeded; a failed bookkeeping update shouldn't read as
  // a failed import, it just means the button won't show as "Added".
  if (updateError) console.error("scout import: failed to backfill finding", updateError);

  return NextResponse.json({
    opportunity_id: result.opportunity.id,
    title: result.opportunity.title,
    pipeline_item_id: result.pipelineItem?.id ?? null,
    plan_limited: result.planLimited,
  });
}
