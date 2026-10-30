import { supabaseAdmin } from "@/lib/supabase/admin";
import { embedText } from "@/lib/embeddings";
import { fetchSamGovOpportunities } from "@/lib/data-sources/sam-gov";
import { generateAISummary } from "@/lib/jobs/handlers/ai-summary";
import type { JobHandler } from "@/lib/jobs/handlers/types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** "sync-sam-gov" — daily SAM.gov notices sync. */
export const syncSamGov: JobHandler<"sync-sam-gov"> = async () => {
  if (!process.env.SAM_GOV_API_KEY) {
    // Surface the gap in ops logs instead of silently no-op'ing, so it's
    // obvious in the ingestion history that a source is unconfigured.
    await supabaseAdmin.from("ingestion_logs").insert({
      source: "sam_gov",
      source_type: "federal",
      status: "partial",
      completed_at: new Date().toISOString(),
      error_message: "SAM_GOV_API_KEY not configured — source skipped",
      records_fetched: 0,
      records_new: 0,
    });
    return { ok: true, skipped: true, reason: "SAM_GOV_API_KEY not configured" };
  }

  const opps = await fetchSamGovOpportunities(0, 50);
  if (!opps.length) return { ok: true, ingested: 0 };

  let newCount = 0;
  let updatedCount = 0;
  const errors: string[] = [];

  for (const opp of opps) {
    try {
      const sourceId = opp.noticeId;
      const { data: existing } = await supabaseAdmin
        .from("opportunities")
        .select("id")
        .eq("source_id", sourceId)
        .eq("source", "sam_gov")
        .maybeSingle();

      const title = opp.title ?? "SAM.gov Opportunity";
      const description = opp.description ?? "";

      const [embedding, aiSummary] = await Promise.all([
        embedText([title, description, `Agency: ${opp.fullParentPathName}`].join("\n")),
        generateAISummary(title, description, "grant/contract"),
      ]);

      let deadline: string | null = null;
      if (opp.responseDeadLine) {
        const d = new Date(opp.responseDeadLine);
        if (!isNaN(d.getTime())) deadline = d.toISOString().split("T")[0];
      }

      // SAM.gov's own "active" flag is a source-of-truth signal (e.g. an award
      // was made or the notice was cancelled), but re-derive expiry from the
      // deadline too so a stale "active" flag can't keep a past-deadline
      // notice looking open — mirrors sync-grants-gov.ts's expiry check.
      const isExpired = opp.active !== "Yes" || (deadline !== null && new Date(deadline) < new Date());

      // Fields SAM.gov re-provides fresh on every sync — safe to overwrite.
      const freshFields = {
        title,
        description,
        funder_name: opp.fullParentPathName?.split(".").pop() ?? "Federal Agency",
        funder_type: "federal_government",
        funding_type: opp.type?.toLowerCase().includes("grant") ? "grant" : "contract",
        amount_min: null,
        amount_max: opp.award?.amount ? parseInt(String(opp.award.amount).replace(/[^0-9]/g, "")) || null : null,
        deadline,
        is_rolling_deadline: !deadline,
        geographic_scope: "national",
        geographic_states: [],
        source_url: opp.uiLink,
        application_url: opp.additionalInfoLink ?? opp.uiLink,
        status: isExpired ? "expired" : "active",
        ai_summary: aiSummary || null,
        embedding: embedding.length > 0 ? embedding : null,
        ai_enriched_at: aiSummary ? new Date().toISOString() : null,
      };

      if (existing) {
        // Don't touch focus_areas/eligibility_types on update — SAM.gov never
        // provides real values for these (they're hardcoded placeholders at
        // insert time), so re-writing them here would blow away any later
        // enrichment without the source actually re-providing fresh data.
        await supabaseAdmin
          .from("opportunities")
          .update({ ...freshFields, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        updatedCount++;
      } else {
        await supabaseAdmin.from("opportunities").insert({
          ...freshFields,
          eligibility_types: ["any"],
          focus_areas: [],
          source: "sam_gov",
          source_id: sourceId,
        });
        newCount++;
      }

      await sleep(400);
    } catch (e) {
      errors.push(`${opp.noticeId}: ${e}`);
    }
  }

  return {
    ok: true,
    ingested: newCount,
    updated: updatedCount,
    total: opps.length,
    errors: errors.slice(0, 5),
  };
};
