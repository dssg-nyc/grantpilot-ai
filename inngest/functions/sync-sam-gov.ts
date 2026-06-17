import { inngest } from "@/inngest/client";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { embedText } from "@/lib/voyage/embeddings";
import { fetchSamGovOpportunities } from "@/lib/data-sources/sam-gov";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function generateAISummary(title: string, description: string): Promise<string> {
  try {
    const resp = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 150,
      messages: [{ role: "user", content: `Write exactly 2 plain English sentences summarizing this grant/contract opportunity. No markdown.\n\nTitle: ${title}\nDescription: ${description.substring(0, 600)}\n\nSummary:` }],
    });
    return resp.content[0]?.type === "text" ? resp.content[0].text.trim() : "";
  } catch { return ""; }
}

export const syncSamGov = inngest.createFunction(
  { id: "sync-sam-gov", name: "Sync SAM.gov Opportunities", concurrency: { limit: 1 }, triggers: [{ cron: "0 2 * * *" }] },
  async ({ step }) => {
    if (!process.env.SAM_GOV_API_KEY) {
      // Surface the gap in ops logs instead of silently no-op'ing, so it's
      // obvious in the ingestion history that a source is unconfigured.
      await step.run("log-skip", async () => {
        await supabaseAdmin.from("ingestion_logs").insert({
          source: "sam_gov",
          source_type: "federal",
          status: "partial",
          completed_at: new Date().toISOString(),
          error_message: "SAM_GOV_API_KEY not configured — source skipped",
          records_fetched: 0,
          records_new: 0,
        });
      });
      return { ok: true, skipped: true, reason: "SAM_GOV_API_KEY not configured" };
    }

    const opps = await step.run("fetch-sam-gov", async () => {
      return fetchSamGovOpportunities(0, 50);
    });

    if (!opps.length) return { ok: true, ingested: 0 };

    let ingested = 0;
    const errors: string[] = [];

    for (const opp of opps) {
      try {
        const sourceId = opp.noticeId;
        const { data: existing } = await supabaseAdmin
          .from("opportunities")
          .select("id")
          .eq("source_id", sourceId)
          .eq("source", "sam_gov")
          .single();

        if (existing) continue;

        const title = opp.title ?? "SAM.gov Opportunity";
        const description = opp.description ?? "";

        const [embedding, aiSummary] = await Promise.all([
          embedText([title, description, `Agency: ${opp.fullParentPathName}`].join("\n")),
          generateAISummary(title, description),
        ]);

        let deadline: string | null = null;
        if (opp.responseDeadLine) {
          const d = new Date(opp.responseDeadLine);
          if (!isNaN(d.getTime())) deadline = d.toISOString().split("T")[0];
        }

        await supabaseAdmin.from("opportunities").insert({
          title,
          description,
          funder_name: opp.fullParentPathName?.split(".").pop() ?? "Federal Agency",
          funder_type: "federal_government",
          funding_type: opp.type?.toLowerCase().includes("grant") ? "grant" : "contract",
          amount_min: null,
          amount_max: opp.award?.amount ? parseInt(String(opp.award.amount).replace(/[^0-9]/g, "")) || null : null,
          deadline,
          is_rolling_deadline: !deadline,
          eligibility_types: ["any"],
          focus_areas: [],
          geographic_scope: "national",
          geographic_states: [],
          source: "sam_gov",
          source_id: sourceId,
          source_url: opp.uiLink,
          application_url: opp.additionalInfoLink ?? opp.uiLink,
          status: opp.active === "Yes" ? "active" : "expired",
          ai_summary: aiSummary || null,
          embedding: embedding.length > 0 ? embedding : null,
          ai_enriched_at: aiSummary ? new Date().toISOString() : null,
        });

        ingested++;
        await sleep(400);
      } catch (e) {
        errors.push(`${opp.noticeId}: ${e}`);
      }
    }

    return { ok: true, ingested, total: opps.length, errors: errors.slice(0, 5) };
  }
);
