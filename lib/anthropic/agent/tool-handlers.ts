import type { SupabaseClient } from "@supabase/supabase-js";
import { embedText } from "@/lib/voyage/embeddings";
import { getPlanLimits } from "@/lib/billing/plans";
import { GRANT_SECTION_KEYS, type GrantSectionKey } from "@/lib/utils/grant-sections";

export interface ToolContext {
  supabase: SupabaseClient;
  orgId: string;
  orgPlan: string | null;
}

type ToolHandler = (ctx: ToolContext, input: Record<string, unknown>) => Promise<unknown>;

function str(input: Record<string, unknown>, key: string): string | undefined {
  const v = input[key];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

// Exported so the Funding Scout agent can reuse the exact same
// FTS-then-vector search when checking what the app already has, rather than
// maintaining a second, divergent copy of that logic.
export async function searchOpportunities(ctx: ToolContext, input: Record<string, unknown>) {
  const query = str(input, "query");
  const focusAreas = Array.isArray(input.focus_areas) ? (input.focus_areas as string[]) : undefined;
  const funderType = str(input, "funder_type");
  const minAmount = typeof input.min_amount === "number" ? input.min_amount : undefined;
  const maxAmount = typeof input.max_amount === "number" ? input.max_amount : undefined;
  const limit = Math.min(typeof input.limit === "number" ? input.limit : 8, 20);

  let dbQuery = ctx.supabase
    .from("opportunities")
    .select("id, title, funder_name, funder_type, amount_min, amount_max, deadline, focus_areas, ai_summary")
    .eq("status", "active")
    .limit(limit);

  if (funderType) dbQuery = dbQuery.eq("funder_type", funderType);
  if (focusAreas?.length) dbQuery = dbQuery.overlaps("focus_areas", focusAreas);
  if (minAmount != null) dbQuery = dbQuery.gte("amount_max", minAmount);
  if (maxAmount != null) dbQuery = dbQuery.lte("amount_min", maxAmount);

  if (query) {
    const { data: ftsResults } = await dbQuery.textSearch("title", query, { type: "websearch" });
    if (ftsResults?.length) return { results: ftsResults };

    // Fall back to semantic search when full-text finds nothing.
    const embedding = await embedText(query);
    if (embedding.length > 0) {
      const { data: vectorResults } = await ctx.supabase.rpc("match_opportunities", {
        query_embedding: embedding,
        match_threshold: 0.4,
        match_count: limit,
      });
      return { results: vectorResults ?? [], note: "Matched by topic similarity, not exact keyword." };
    }
    return { results: [] };
  }

  const { data, error } = await dbQuery;
  if (error) return { error: error.message };
  return { results: data ?? [] };
}

async function getOpportunityDetail(ctx: ToolContext, input: Record<string, unknown>) {
  const opportunityId = str(input, "opportunity_id");
  if (!opportunityId) return { error: "opportunity_id is required" };

  const { data: opp, error } = await ctx.supabase
    .from("opportunities")
    .select("*")
    .eq("id", opportunityId)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!opp) return { error: "Opportunity not found" };

  const { data: match } = await ctx.supabase
    .from("matches")
    .select("match_score, success_probability, match_reasons, disqualifiers")
    .eq("org_id", ctx.orgId)
    .eq("opportunity_id", opportunityId)
    .maybeSingle();

  return { opportunity: opp, match: match ?? null };
}

async function getMatches(ctx: ToolContext, input: Record<string, unknown>) {
  const limit = Math.min(typeof input.limit === "number" ? input.limit : 10, 25);
  const { data, error } = await ctx.supabase
    .from("matches")
    .select("id, opportunity_id, match_score, success_probability, match_reasons, disqualifiers, opportunity:opportunities(title, funder_name, deadline, amount_min, amount_max)")
    .eq("org_id", ctx.orgId)
    .order("match_score", { ascending: false })
    .limit(limit);
  if (error) return { error: error.message };
  return { matches: data ?? [] };
}

async function getPipeline(ctx: ToolContext) {
  const { data, error } = await ctx.supabase
    .from("pipeline_items")
    .select("id, title, stage, deadline, notes, opportunity_id, opportunity:opportunities(title, funder_name)")
    .eq("org_id", ctx.orgId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) return { error: error.message };
  return { pipeline_items: data ?? [] };
}

async function addToPipeline(ctx: ToolContext, input: Record<string, unknown>) {
  const opportunityId = str(input, "opportunity_id");
  if (!opportunityId) return { error: "opportunity_id is required" };
  const notes = str(input, "notes") ?? null;

  const { data: existing } = await ctx.supabase
    .from("pipeline_items")
    .select("*")
    .eq("org_id", ctx.orgId)
    .eq("opportunity_id", opportunityId)
    .is("deleted_at", null)
    .maybeSingle();
  if (existing) return { pipeline_item: existing, already_existed: true };

  const limits = getPlanLimits(ctx.orgPlan);
  const { count } = await ctx.supabase
    .from("pipeline_items")
    .select("id", { count: "exact", head: true })
    .eq("org_id", ctx.orgId)
    .is("deleted_at", null);
  if ((count ?? 0) >= limits.maxActivePipelineItems) {
    return { error: `Pipeline is at the free plan's limit of ${limits.maxActivePipelineItems} items. Tell the user they'd need to upgrade or remove something first.` };
  }

  const { data: opp } = await ctx.supabase.from("opportunities").select("title").eq("id", opportunityId).maybeSingle();

  const { data, error } = await ctx.supabase
    .from("pipeline_items")
    .insert({ org_id: ctx.orgId, opportunity_id: opportunityId, title: opp?.title ?? "Untitled opportunity", notes, stage: "saved" })
    .select()
    .single();
  if (error) return { error: error.message };
  return { pipeline_item: data, already_existed: false };
}

const VALID_STAGES = new Set(["saved", "researching", "drafting", "submitted", "awarded", "rejected", "withdrawn"]);

async function updatePipelineStage(ctx: ToolContext, input: Record<string, unknown>) {
  const pipelineItemId = str(input, "pipeline_item_id");
  const stage = str(input, "stage");
  if (!pipelineItemId || !stage) return { error: "pipeline_item_id and stage are required" };
  if (!VALID_STAGES.has(stage)) return { error: "Invalid stage" };

  const { data, error } = await ctx.supabase
    .from("pipeline_items")
    .update({ stage })
    .eq("id", pipelineItemId)
    .eq("org_id", ctx.orgId)
    .select()
    .single();
  if (error) return { error: error.message };
  if (!data) return { error: "Pipeline item not found" };
  return { pipeline_item: data };
}

async function getDraft(ctx: ToolContext, input: Record<string, unknown>) {
  const pipelineItemId = str(input, "pipeline_item_id");
  if (!pipelineItemId) return { error: "pipeline_item_id is required" };

  const { data: item, error: itemError } = await ctx.supabase
    .from("pipeline_items")
    .select("id")
    .eq("id", pipelineItemId)
    .eq("org_id", ctx.orgId)
    .maybeSingle();
  if (itemError) return { error: itemError.message };
  if (!item) return { error: "Pipeline item not found" };

  const { data: sections, error } = await ctx.supabase
    .from("grant_drafts")
    .select("section_key, content, status, updated_at")
    .eq("pipeline_item_id", pipelineItemId);
  if (error) return { error: error.message };

  const present = new Set((sections ?? []).map((s) => s.section_key));
  const missing = GRANT_SECTION_KEYS.filter((k) => !present.has(k));

  return { sections: sections ?? [], missing_sections: missing };
}

async function writeDraftSection(ctx: ToolContext, input: Record<string, unknown>) {
  const pipelineItemId = str(input, "pipeline_item_id");
  const sectionKey = str(input, "section_key") as GrantSectionKey | undefined;
  const content = str(input, "content");
  if (!pipelineItemId || !sectionKey || !content) {
    return { error: "pipeline_item_id, section_key, and content are all required" };
  }
  if (!GRANT_SECTION_KEYS.includes(sectionKey)) return { error: "Invalid section_key" };

  const { data: item, error: itemError } = await ctx.supabase
    .from("pipeline_items")
    .select("id")
    .eq("id", pipelineItemId)
    .eq("org_id", ctx.orgId)
    .maybeSingle();
  if (itemError) return { error: itemError.message };
  if (!item) return { error: "Pipeline item not found" };

  const { data, error } = await ctx.supabase
    .from("grant_drafts")
    .upsert(
      { org_id: ctx.orgId, pipeline_item_id: pipelineItemId, section_key: sectionKey, content, updated_at: new Date().toISOString() },
      { onConflict: "pipeline_item_id,section_key" },
    )
    .select()
    .single();
  if (error) return { error: error.message };
  return { saved: true, section: data };
}

async function importWebOpportunity(ctx: ToolContext, input: Record<string, unknown>) {
  const url = str(input, "url");
  const funderName = str(input, "funder_name");
  const funderType = str(input, "funder_type") as
    | "federal_government" | "state_government" | "foundation" | "corporate" | "international" | "other"
    | undefined;

  if (!url || !funderName) return { error: "url and funder_name are required" };

  const { importOpportunityFromUrl } = await import("@/lib/opportunities/import-from-url");
  const result = await importOpportunityFromUrl({
    url,
    funderName,
    funderType,
    orgId: ctx.orgId,
    orgSupabase: ctx.supabase,
  });

  if ("error" in result) return { error: result.error };
  return {
    imported: true,
    opportunity_id: result.opportunity.id,
    title: result.opportunity.title,
    added_to_pipeline: !!result.pipelineItem,
    pipeline_item_id: result.pipelineItem?.id ?? null,
    plan_limited: result.planLimited,
  };
}

export const TOOL_HANDLERS: Record<string, ToolHandler> = {
  search_opportunities: searchOpportunities,
  get_opportunity_detail: getOpportunityDetail,
  get_matches: getMatches,
  get_pipeline: getPipeline,
  add_to_pipeline: addToPipeline,
  update_pipeline_stage: updatePipelineStage,
  get_draft: getDraft,
  write_draft_section: writeDraftSection,
  import_web_opportunity: importWebOpportunity,
};
