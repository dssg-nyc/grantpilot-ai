import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { inngest } from "@/inngest/client";
import { crawlGrantPage } from "@/lib/firecrawl/client";
import { extractOpportunitiesFromMarkdown } from "@/lib/firecrawl/scrapers/grant-page-parser";
import { embedText } from "@/lib/voyage/embeddings";
import { computeMatchRowsForOrg } from "@/lib/matching/compute";
import { rateLimitGuard, strictRateLimiter } from "@/lib/redis/rate-limiter";
import { getPlanLimits } from "@/lib/billing/plans";
import type { Opportunity } from "@/types/opportunity";
import type { OrgProfile } from "@/types/profile";

async function getOrgId() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, orgId: null };
  const { data } = await supabase.from("users").select("org_id").eq("id", user.id).single();
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

  if (!url.trim() || !funderName.trim()) {
    return NextResponse.json({ error: "url and funder_name are required" }, { status: 400 });
  }
  if (!/^https?:\/\//.test(url)) {
    return NextResponse.json({ error: "url must start with http:// or https://" }, { status: 400 });
  }

  const markdown = await crawlGrantPage(url);
  if (!markdown.trim()) {
    return NextResponse.json(
      { error: "Couldn't extract grant details from that page. Try adding it manually instead." },
      { status: 422 },
    );
  }

  const grants = await extractOpportunitiesFromMarkdown(markdown, funderName);
  if (grants.length === 0) {
    return NextResponse.json(
      { error: "Couldn't extract grant details from that page. Try adding it manually instead." },
      { status: 422 },
    );
  }

  const grant = grants[0];

  const service_states = geographicStates ?? [];
  const geographic_scope =
    service_states.length === 0 ? "national" : service_states.length === 1 ? "state" : "multi_state";

  let deadline: string | null = null;
  if (grant.deadline) {
    const d = new Date(grant.deadline);
    if (!isNaN(d.getTime())) deadline = d.toISOString().split("T")[0];
  }
  const is_rolling_deadline = !deadline;
  const status = deadline && new Date(deadline) < new Date() ? "expired" : "active";

  const embedding = await embedText(
    [grant.title, grant.description, `Funder: ${funderName}`].join("\n"),
  );

  const source_id = `user_${Buffer.from(url).toString("base64").slice(0, 32)}`;

  const { data: opportunity, error: oppError } = await supabaseAdmin
    .from("opportunities")
    .upsert(
      {
        title: grant.title.slice(0, 500),
        description: grant.description ?? "",
        funder_name: funderName,
        funder_type: funderType ?? "other",
        funding_type: "grant",
        amount_min: grant.amount_min,
        amount_max: grant.amount_max,
        deadline,
        is_rolling_deadline,
        eligibility_types: grant.eligibility_types?.length ? grant.eligibility_types : ["nonprofit_501c3"],
        focus_areas: grant.focus_areas ?? [],
        geographic_scope,
        geographic_states: service_states,
        source: "user_submitted",
        source_id,
        source_url: url,
        application_url: grant.application_url ?? url,
        status,
        embedding: embedding.length > 0 ? embedding : null,
        ai_enriched_at: new Date().toISOString(),
        ai_summary: grant.description,
        submitted_by_org_id: orgId,
      },
      { onConflict: "source,source_id" },
    )
    .select()
    .single();

  if (oppError) return NextResponse.json({ error: oppError.message }, { status: 500 });

  // Free-tier cap on active pipeline items applies to the submitting org's own
  // pipeline row — but never blocks the shared-pool contribution above (the
  // `opportunities` upsert already happened and benefits every org's matcher).
  const { data: orgRow } = await supabase
    .from("organizations")
    .select("plan")
    .eq("id", orgId)
    .single();
  const limits = getPlanLimits(orgRow?.plan);
  const { count: activeCount } = await supabase
    .from("pipeline_items")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .is("deleted_at", null);

  let pipelineItem = null;
  let planLimited = false;
  if ((activeCount ?? 0) >= limits.maxActivePipelineItems) {
    planLimited = true;
  } else {
    const { data: insertedPipelineItem, error: pipelineError } = await supabase
      .from("pipeline_items")
      .insert({
        org_id: orgId,
        opportunity_id: opportunity.id,
        title: opportunity.title,
        stage: "saved",
      })
      .select()
      .single();

    if (pipelineError) return NextResponse.json({ error: pipelineError.message }, { status: 500 });
    pipelineItem = insertedPipelineItem;
  }

  // Fire-and-forget: surface the new grant to the async matcher for every org.
  void inngest.send({
    name: "grants/new-opportunities",
    data: { count: 1, source: "user_submitted" },
  });

  // Best-effort synchronous match compute for the submitting org — don't fail
  // the request if this errors, the async matcher will catch it up regardless.
  try {
    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("*")
      .eq("id", orgId)
      .single();
    if (org?.profile_embedding) {
      const matchRows = await computeMatchRowsForOrg(org as unknown as OrgProfile & { id: string });
      if (matchRows.length > 0) {
        await supabaseAdmin.from("matches").upsert(matchRows, { onConflict: "org_id,opportunity_id" });
      }
    }
  } catch (e) {
    console.error("opportunities/submit: match compute failed", e);
  }

  return NextResponse.json(
    { opportunity, pipeline_item: pipelineItem, plan_limited: planLimited },
    { status: 200 },
  );
}
