import { inngest } from "@/inngest/client";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fetchGrantsGovOpportunities, fetchGrantDetails } from "@/lib/data-sources/grants-gov";
import { embedTexts } from "@/lib/voyage/embeddings";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Run async mappers with a bounded concurrency so we don't burst external APIs.
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    }),
  );
  return out;
}

// Shape returned by the grants.gov search endpoint (list view — no description/amounts).
interface RawGrantsGovOpp {
  id: string;
  number?: string;
  title: string;
  agency?: string;
  agencyCode?: string;
  openDate?: string;
  closeDate?: string;
  oppStatus?: string;
  cfdaList?: string[];
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

        // 1. Enrich every opp via the details endpoint (search only returns list fields).
        const prepared = await mapWithConcurrency(rawOpps, 8, async (raw) => {
          const details = await fetchGrantDetails(String(raw.id));
          const description = details.description ?? "";
          const amountMin = details.awardFloor ? parseInt(details.awardFloor) : null;
          const amountMax = details.awardCeiling ? parseInt(details.awardCeiling) : null;
          return {
            raw,
            description,
            agencyName: raw.agency ?? "Federal Agency",
            elig: parseEligibility(details.eligibilities),
            amountMin: Number.isNaN(amountMin as number) ? null : amountMin,
            amountMax: Number.isNaN(amountMax as number) ? null : amountMax,
          };
        });

        // 2. Embed the whole page in ONE batched Voyage request (avoids 429s).
        const embeddings = await embedTexts(
          prepared.map((p) =>
            [p.raw.title, p.description, `Funder: ${p.agencyName}`, `Eligibility: ${p.elig.join(", ")}`].join("\n"),
          ),
        );

        // 3. AI summaries with bounded concurrency (respect Anthropic limits).
        const summaries = await mapWithConcurrency(prepared, 5, (p) =>
          p.description ? generateAISummary(p.raw.title, p.description) : Promise.resolve(""),
        );

        // 4. Store (upsert by source + source_id).
        for (let i = 0; i < prepared.length; i++) {
          const p = prepared[i];
          try {
            const aiSummary = summaries[i];
            const embedding = embeddings[i] ?? [];
            const opp = {
              title: p.raw.title,
              description: p.description,
              funder_name: p.agencyName,
              funder_type: "federal_government",
              funding_type: "grant",
              amount_min: p.amountMin,
              amount_max: p.amountMax,
              deadline: p.raw.closeDate
                ? new Date(p.raw.closeDate).toISOString().split("T")[0]
                : null,
              posted_date: p.raw.openDate
                ? new Date(p.raw.openDate).toISOString().split("T")[0]
                : null,
              is_rolling_deadline: !p.raw.closeDate,
              eligibility_types: p.elig,
              focus_areas: [] as string[],
              geographic_scope: "national",
              geographic_states: [] as string[],
              source: "grants_gov",
              source_id: String(p.raw.id),
              source_url: `https://www.grants.gov/search-results-detail/${p.raw.id}`,
              application_url: `https://www.grants.gov/search-results-detail/${p.raw.id}`,
              status:
                p.raw.closeDate && new Date(p.raw.closeDate) < new Date()
                  ? "expired"
                  : "active",
              ai_summary: aiSummary || null,
              embedding: embedding.length > 0 ? embedding : null,
              ai_enriched_at: aiSummary ? new Date().toISOString() : null,
            };

            const { data: existing } = await supabaseAdmin
              .from("opportunities")
              .select("id")
              .eq("source_id", String(p.raw.id))
              .eq("source", "grants_gov")
              .maybeSingle();

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
            console.error(`Failed to process grant ${p.raw.id}:`, err);
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
