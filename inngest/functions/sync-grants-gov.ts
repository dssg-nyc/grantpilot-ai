import { inngest } from "@/inngest/client";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fetchGrantsGovOpportunities } from "@/lib/data-sources/grants-gov";
import { embedText } from "@/lib/voyage/embeddings";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface RawGrantsGovOpp {
  id: string;
  title: string;
  synopsis?: string;
  description?: string;
  agencyName?: string;
  awardFloor?: string;
  awardCeiling?: string;
  closeDate?: string;
  oppStatus?: string;
  additionalInformationUrl?: string;
  eligibilities?: string[];
  cfda?: string;
}

function parseEligibility(raw: string[] | undefined): string[] {
  if (!raw?.length) return ["any"];
  const map: Record<string, string> = {
    "25": "nonprofit_501c3",
    "20": "educational",
    "12": "government",
    "11": "government",
    "21": "individual",
  };
  return raw.map((e) => map[e] ?? "nonprofit_other").filter(Boolean);
}

async function generateAISummary(title: string, description: string): Promise<string> {
  try {
    const resp = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 150,
      messages: [
        {
          role: "user",
          content: `Write a 2-sentence plain-English summary of this grant opportunity. Be specific about who should apply and what it funds.\n\nTitle: ${title}\n\nDescription: ${description.substring(0, 1000)}\n\nSummary:`,
        },
      ],
    });
    return resp.content[0]?.type === "text" ? resp.content[0].text.trim() : "";
  } catch {
    return "";
  }
}

export const syncGrantsGov = inngest.createFunction(
  {
    id: "sync-grants-gov",
    name: "Sync Grants.gov Opportunities",
    concurrency: { limit: 1 },
    triggers: [{ cron: "0 */4 * * *" }, { event: "grants/sync.requested" }],
  },
  async ({ step }) => {
    const logId = await step.run("create-log", async () => {
      const { data } = await supabaseAdmin
        .from("ingestion_logs")
        .insert({ source: "grants_gov", source_type: "federal", status: "running" })
        .select("id")
        .single();
      return data?.id as string;
    });

    let page = 0;
    let totalFetched = 0;
    let totalNew = 0;
    let totalUpdated = 0;

    while (true) {
      const rawOpps: RawGrantsGovOpp[] = await step.run(`fetch-page-${page}`, async () => {
        return fetchGrantsGovOpportunities(page, 100);
      });

      if (rawOpps.length === 0) break;

      const results = await step.run(`process-page-${page}`, async () => {
        let newCount = 0;
        let updatedCount = 0;

        for (const raw of rawOpps) {
          try {
            const description = raw.synopsis ?? raw.description ?? "";
            const embeddingText = [
              raw.title,
              description,
              `Funder: ${raw.agencyName ?? "Federal Agency"}`,
              "Eligibility: nonprofit_501c3, educational, government",
            ].join("\n");

            const [embedding, aiSummary] = await Promise.all([
              embedText(embeddingText),
              description ? generateAISummary(raw.title, description) : Promise.resolve(""),
            ]);

            const opp = {
              title: raw.title,
              description,
              funder_name: raw.agencyName ?? "Federal Agency",
              funder_type: "federal_government",
              funding_type: "grant",
              amount_min: raw.awardFloor ? parseInt(raw.awardFloor) : null,
              amount_max: raw.awardCeiling ? parseInt(raw.awardCeiling) : null,
              deadline: raw.closeDate
                ? new Date(raw.closeDate).toISOString().split("T")[0]
                : null,
              is_rolling_deadline: !raw.closeDate,
              eligibility_types: parseEligibility(raw.eligibilities),
              focus_areas: [] as string[],
              geographic_scope: "national",
              geographic_states: [] as string[],
              source: "grants_gov",
              source_id: String(raw.id),
              source_url: `https://www.grants.gov/search-results-detail/${raw.id}`,
              application_url: raw.additionalInformationUrl ?? null,
              status:
                raw.closeDate && new Date(raw.closeDate) < new Date()
                  ? "expired"
                  : "active",
              ai_summary: aiSummary || null,
              embedding: embedding.length > 0 ? embedding : null,
              ai_enriched_at: aiSummary ? new Date().toISOString() : null,
            };

            // Upsert by source_id
            const { data: existing } = await supabaseAdmin
              .from("opportunities")
              .select("id")
              .eq("source_id", String(raw.id))
              .eq("source", "grants_gov")
              .single();

            if (existing) {
              await supabaseAdmin
                .from("opportunities")
                .update({ ...opp, updated_at: new Date().toISOString() })
                .eq("id", existing.id);
              updatedCount++;
            } else {
              await supabaseAdmin.from("opportunities").insert(opp);
              newCount++;
            }
          } catch (err) {
            console.error(`Failed to process grant ${raw.id}:`, err);
          }
        }

        return { newCount, updatedCount };
      });

      totalFetched += rawOpps.length;
      totalNew += results.newCount;
      totalUpdated += results.updatedCount;
      page++;

      if (rawOpps.length < 100) break;
    }

    // Trigger match recompute if new opps were added
    if (totalNew > 0) {
      await step.sendEvent("trigger-match-compute", {
        name: "grants/new-opportunities",
        data: { count: totalNew, source: "grants_gov" },
      });
    }

    await step.run("update-log", async () => {
      await supabaseAdmin
        .from("ingestion_logs")
        .update({
          status: "success",
          completed_at: new Date().toISOString(),
          records_fetched: totalFetched,
          records_new: totalNew,
          records_updated: totalUpdated,
        })
        .eq("id", logId);
    });

    return { totalFetched, totalNew, totalUpdated };
  },
);
