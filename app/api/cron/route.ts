import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fetchGrantsGovOpportunities, fetchGrantDetails } from "@/lib/data-sources/grants-gov";
import { embedText } from "@/lib/voyage/embeddings";
import Anthropic from "@anthropic-ai/sdk";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function parseEligibility(raw: string[] | undefined): string[] {
  if (!raw?.length) return ["any"];
  const map: Record<string, string> = { "25": "nonprofit_501c3", "20": "educational", "12": "government", "11": "government", "21": "individual" };
  return raw.map((e) => map[e] ?? "nonprofit_other").filter(Boolean);
}

async function generateAISummary(title: string, description: string): Promise<string> {
  try {
    const resp = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 150,
      messages: [{ role: "user", content: `Write exactly 2 plain English sentences summarizing this grant. No markdown, no headers, no bullet points. First sentence: who should apply. Second sentence: what it funds and approximate award range.\n\nTitle: ${title}\nDescription: ${description.substring(0, 800)}\n\nSummary:` }],
    });
    return resp.content[0]?.type === "text" ? resp.content[0].text.trim() : "";
  } catch { return ""; }
}

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const maxPages = parseInt(searchParams.get("pages") ?? "2");
  const batchSize = parseInt(searchParams.get("batch") ?? "10");

  let totalNew = 0; let totalUpdated = 0; let totalFetched = 0;
  const errors: string[] = [];

  const { data: logRow } = await supabaseAdmin
    .from("ingestion_logs")
    .insert({ source: "grants_gov", source_type: "federal", status: "running" })
    .select("id").single();
  const logId = logRow?.id;

  for (let page = 0; page < maxPages; page++) {
    let rawOpps: import("@/lib/data-sources/grants-gov").GrantsGovOpp[];
    try {
      rawOpps = await fetchGrantsGovOpportunities(page, batchSize);
    } catch (e) {
      errors.push(`fetch page ${page}: ${e}`);
      break;
    }
    if (!rawOpps.length) break;
    totalFetched += rawOpps.length;

    for (const raw of rawOpps) {
      try {
        // Correct field mapping for Grants.gov search API
        const id = String(raw.id ?? "");
        const title = String(raw.title ?? "Untitled");
        const funderName = String(raw.agency ?? "Federal Agency");
        const rawCloseDate = String(raw.closeDate ?? "").trim();

        // Fetch detail to get description, amounts, eligibility
        const details = await fetchGrantDetails(id);
        const description = details.description ?? details.synopsis ?? "";

        // Check if this grant already has an embedding so we can skip the Voyage call
        const { data: existingCheck } = await supabaseAdmin
          .from("opportunities").select("id,embedding").eq("source_id", id).eq("source", "grants_gov").single();
        const hasEmbedding = !!(existingCheck?.embedding);

        const embeddingText = [title, description || title, `Funder: ${funderName}`].join("\n");
        const [embedding, aiSummary] = await Promise.all([
          hasEmbedding ? Promise.resolve([] as number[]) : embedText(embeddingText),
          generateAISummary(title, description || title),
        ]);

        // Parse close date (format: "06/30/2026")
        let deadline: string | null = null;
        if (rawCloseDate && rawCloseDate !== "null") {
          const parts = rawCloseDate.split("/");
          if (parts.length === 3) {
            deadline = `${parts[2]}-${parts[0].padStart(2,"0")}-${parts[1].padStart(2,"0")}`;
          }
        }

        const opp = {
          title,
          description,
          funder_name: funderName,
          funder_type: "federal_government",
          funding_type: "grant",
          amount_min: details.awardFloor ? parseInt(String(details.awardFloor)) : null,
          amount_max: details.awardCeiling ? parseInt(String(details.awardCeiling)) : null,
          deadline,
          is_rolling_deadline: !deadline,
          eligibility_types: parseEligibility(details.eligibilities),
          focus_areas: [] as string[],
          geographic_scope: "national",
          geographic_states: [] as string[],
          source: "grants_gov",
          source_id: id,
          source_url: `https://www.grants.gov/search-results-detail/${id}`,
          application_url: null as string | null,
          status: deadline && new Date(deadline) < new Date() ? "expired" : "active",
          ai_summary: aiSummary || null,
          embedding: embedding.length > 0 ? embedding : null,
          ai_enriched_at: aiSummary ? new Date().toISOString() : null,
        };

        if (existingCheck) {
          // Preserve existing embedding if we skipped re-embedding
          const updatePayload = hasEmbedding
            ? { ...opp, embedding: existingCheck.embedding, updated_at: new Date().toISOString() }
            : { ...opp, updated_at: new Date().toISOString() };
          await supabaseAdmin.from("opportunities").update(updatePayload).eq("id", existingCheck.id);
          totalUpdated++;
        } else {
          await supabaseAdmin.from("opportunities").insert(opp);
          totalNew++;
        }
        // Pace requests to avoid Voyage AI 429s
        await sleep(300);
      } catch (e) {
        errors.push(`process ${raw.id}: ${e}`);
      }
    }
    if (rawOpps.length < batchSize) break;
  }

  if (logId) {
    await supabaseAdmin.from("ingestion_logs").update({
      status: errors.length > totalNew + totalUpdated ? "failed" : "success",
      completed_at: new Date().toISOString(),
      records_fetched: totalFetched,
      records_new: totalNew,
      records_updated: totalUpdated,
      records_failed: errors.length,
    }).eq("id", logId);
  }

  return NextResponse.json({ ok: true, totalFetched, totalNew, totalUpdated, errors: errors.slice(0, 5) });
}
