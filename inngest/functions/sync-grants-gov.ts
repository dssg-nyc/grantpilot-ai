import { inngest } from "@/inngest/client";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fetchGrantsGovOpportunities, fetchGrantDetails } from "@/lib/data-sources/grants-gov";
import { embedTexts } from "@/lib/voyage/embeddings";
import { FOCUS_AREA_TAXONOMY } from "@/lib/utils/taxonomy";
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

interface AIEnrichment {
  summary: string;
  focusAreas: string[];
}

const EMPTY_ENRICHMENT: AIEnrichment = { summary: "", focusAreas: [] };

// One combined call (summary + focus-area classification) instead of two —
// same taxonomy list used by profile extraction and the onboarding wizard
// (lib/utils/taxonomy.ts), so opportunity.focus_areas can actually overlap
// with an org's primary_focus_areas in matching and in the Opportunities
// filter UI. Before this, every grants.gov opportunity stored focus_areas
// as a hardcoded empty array, which silently zeroed the focus-area
// component of every match score and made the focus-area filter always
// return zero results.
async function enrichWithAI(title: string, description: string): Promise<AIEnrichment> {
  if (!description) return EMPTY_ENRICHMENT;
  try {
    const resp = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 250,
      messages: [
        {
          role: "user",
          content: `You are classifying a US grant opportunity for a nonprofit funding platform. Respond in valid JSON only, no preamble.

Title: ${title}

Description: ${description.substring(0, 1500)}

RESPOND ONLY WITH:
{
  "summary": <2-sentence plain-English summary — be specific about who should apply and what it funds>,
  "focus_areas": <array of 1-3 focus areas from this exact list: ${JSON.stringify(FOCUS_AREA_TAXONOMY)}>
}`,
        },
      ],
    });
    const text = resp.content[0]?.type === "text" ? resp.content[0].text.trim() : "";
    const jsonText = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    const parsed = JSON.parse(jsonText);
    const validAreas = new Set<string>(FOCUS_AREA_TAXONOMY);
    const focusAreas = Array.isArray(parsed.focus_areas)
      ? parsed.focus_areas.filter((a: unknown): a is string => typeof a === "string" && validAreas.has(a))
      : [];
    return {
      summary: typeof parsed.summary === "string" ? parsed.summary.trim() : "",
      focusAreas,
    };
  } catch {
    return EMPTY_ENRICHMENT;
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

        // 3. AI summary + focus-area classification, bounded concurrency (respect Anthropic limits).
        const enrichments = await mapWithConcurrency(prepared, 5, (p) =>
          enrichWithAI(p.raw.title, p.description),
        );

        // 4. Store (upsert by source + source_id).
        for (let i = 0; i < prepared.length; i++) {
          const p = prepared[i];
          try {
            const aiSummary = enrichments[i].summary;
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
              focus_areas: enrichments[i].focusAreas,
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
