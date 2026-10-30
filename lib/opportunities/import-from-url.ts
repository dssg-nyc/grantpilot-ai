import { supabaseAdmin } from "@/lib/supabase/admin";
import { crawlGrantPage } from "@/lib/scraper/client";
import { extractOpportunitiesFromMarkdown } from "@/lib/scraper/grant-page-parser";
import { embedText } from "@/lib/embeddings";
import { computeMatchRowsForOrg } from "@/lib/matching/compute";
import { getPlanLimits } from "@/lib/billing/plans";
import { enqueue } from "@/lib/jobs/queue";
import type { Opportunity } from "@/types/opportunity";
import type { OrgProfile } from "@/types/profile";
import type { PipelineItem } from "@/types/pipeline";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface ImportOpportunityResult {
  opportunity: Opportunity;
  pipelineItem: PipelineItem | null;
  planLimited: boolean;
}

export interface ImportOpportunityError {
  error: string;
  status: number;
}

/**
 * Scrapes a grant URL, AI-extracts structured opportunity data, embeds it,
 * and upserts it into the SHARED opportunities pool (visible to every org's
 * matcher and search, not just the submitting org) — then adds it to the
 * submitting org's own pipeline. Single source of truth for "bring an
 * external grant URL into the app for real" — used by both the manual
 * "submit a grant" API route and the AI assistant's web-search-to-import tool.
 */
export async function importOpportunityFromUrl(params: {
  url: string;
  funderName: string;
  funderType?: Opportunity["funder_type"];
  geographicStates?: string[];
  orgId: string;
  orgSupabase: SupabaseClient;
  addToPipeline?: boolean;
}): Promise<ImportOpportunityResult | ImportOpportunityError> {
  const { url, funderName, funderType, geographicStates, orgId, orgSupabase, addToPipeline = true } = params;

  if (!url.trim() || !funderName.trim()) {
    return { error: "url and funder_name are required", status: 400 };
  }
  if (!/^https?:\/\//.test(url)) {
    return { error: "url must start with http:// or https://", status: 400 };
  }

  // The scraper throws on blocked addresses, HTTP errors and non-HTML (e.g.
  // PDF) pages — all "we couldn't read it", not server faults.
  let markdown: string;
  try {
    markdown = await crawlGrantPage(url);
  } catch (e) {
    console.warn(`[import-from-url] fetch failed for ${url}:`, e instanceof Error ? e.message : e);
    return { error: "Couldn't read that page (it may block automated access or not be an HTML page).", status: 422 };
  }
  if (!markdown.trim()) {
    return { error: "Couldn't extract grant details from that page.", status: 422 };
  }

  const grants = await extractOpportunitiesFromMarkdown(markdown, funderName);
  if (grants.length === 0) {
    return { error: "Couldn't extract grant details from that page.", status: 422 };
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

  const embedding = await embedText([grant.title, grant.description, `Funder: ${funderName}`].join("\n"));
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

  if (oppError) return { error: oppError.message, status: 500 };

  let pipelineItem: PipelineItem | null = null;
  let planLimited = false;

  if (addToPipeline) {
    const { data: orgRow } = await orgSupabase.from("organizations").select("plan").eq("id", orgId).single();
    const limits = getPlanLimits(orgRow?.plan);
    const { count: activeCount } = await orgSupabase
      .from("pipeline_items")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .is("deleted_at", null);

    if ((activeCount ?? 0) >= limits.maxActivePipelineItems) {
      planLimited = true;
    } else {
      const { data: existing } = await orgSupabase
        .from("pipeline_items")
        .select("*")
        .eq("org_id", orgId)
        .eq("opportunity_id", opportunity.id)
        .is("deleted_at", null)
        .maybeSingle();

      if (existing) {
        pipelineItem = existing as PipelineItem;
      } else {
        const { data: inserted, error: pipelineError } = await orgSupabase
          .from("pipeline_items")
          .insert({ org_id: orgId, opportunity_id: opportunity.id, title: opportunity.title, stage: "saved" })
          .select()
          .single();
        if (pipelineError) return { error: pipelineError.message, status: 500 };
        pipelineItem = inserted as PipelineItem;
      }
    }
  }

  // Fire-and-forget: surface the new grant to the async matcher for every org.
  enqueue("grants/new-opportunities", { count: 1, source: "user_submitted" })
    .catch((e) => console.error("importOpportunityFromUrl: enqueue failed", e));

  // Best-effort synchronous match compute for the importing org.
  try {
    const { data: org } = await supabaseAdmin.from("organizations").select("*").eq("id", orgId).single();
    if (org?.profile_embedding) {
      const matchRows = await computeMatchRowsForOrg(org as unknown as OrgProfile & { id: string });
      if (matchRows.length > 0) {
        await supabaseAdmin.from("matches").upsert(matchRows, { onConflict: "org_id,opportunity_id" });
      }
    }
  } catch (e) {
    console.error("importOpportunityFromUrl: match compute failed", e);
  }

  return { opportunity: opportunity as Opportunity, pipelineItem, planLimited };
}
