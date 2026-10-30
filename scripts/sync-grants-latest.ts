/**
 * Pull the most-recently-posted grants.gov opportunities (sorted by openDate),
 * store them with their real posted_date, then recompute matches for every org.
 * Use locally to refresh data (the 4h worker cron only runs where worker/index.ts is running).
 * Run: npx tsx scripts/sync-grants-latest.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const log = (...a: unknown[]) => console.log(...a);
const COUNT = Number(process.env.SYNC_COUNT ?? 40);

const eligMap: Record<string, string> = {
  "25": "nonprofit_501c3", "20": "educational", "12": "government", "11": "government", "21": "individual",
};
const parseElig = (raw?: string[]) => (!raw?.length ? ["any"] : raw.map((e) => eligMap[e] ?? "nonprofit_other"));
const toISO = (d?: string) => { if (!d) return null; const t = new Date(d); return isNaN(t.getTime()) ? null : t.toISOString().split("T")[0]; };

async function main() {
  const { fetchGrantsGovOpportunities, fetchGrantDetails } = await import("@/lib/data-sources/grants-gov");
  const { embedTexts } = await import("@/lib/embeddings");
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const { vectorSimilaritySearch } = await import("@/lib/matching/vector-search");
  const { computeCompositeScore } = await import("@/lib/matching/score-calculator");
  const { batchAnalyzeMatches } = await import("@/lib/anthropic/match-analyzer");

  // ---- FETCH newest (already sorted openDate desc) ----
  log(`\n=== FETCH ${COUNT} newest grants.gov opportunities ===`);
  const list = await fetchGrantsGovOpportunities(0, COUNT);
  log(`Fetched ${list.length}. Newest openDate: ${list[0]?.openDate}`);

  // ---- ENRICH + EMBED + STORE ----
  const enriched = [];
  for (const raw of list) {
    const details = await fetchGrantDetails(String(raw.id));
    enriched.push({ raw, details, description: details.description ?? "", elig: parseElig(details.eligibilities) });
  }
  const embeddings = await embedTexts(
    enriched.map((e) => [e.raw.title, e.description, `Funder: ${e.raw.agency ?? "Federal Agency"}`, `Eligibility: ${e.elig.join(", ")}`].join("\n")),
  );

  let newCount = 0;
  const today = new Date().toISOString().split("T")[0];
  let postedToday = 0;
  for (let i = 0; i < enriched.length; i++) {
    const { raw, details, description, elig } = enriched[i];
    const amountMin = details.awardFloor ? parseInt(details.awardFloor) : null;
    const amountMax = details.awardCeiling ? parseInt(details.awardCeiling) : null;
    const postedDate = toISO(raw.openDate);
    if (postedDate === today) postedToday++;
    const row = {
      title: raw.title,
      description,
      funder_name: raw.agency ?? "Federal Agency",
      funder_type: "federal_government",
      funding_type: "grant",
      amount_min: Number.isNaN(amountMin as number) ? null : amountMin,
      amount_max: Number.isNaN(amountMax as number) ? null : amountMax,
      deadline: toISO(raw.closeDate),
      posted_date: postedDate,
      is_rolling_deadline: !raw.closeDate,
      eligibility_types: elig,
      focus_areas: [] as string[],
      geographic_scope: "national",
      geographic_states: [] as string[],
      source: "grants_gov",
      source_id: String(raw.id),
      source_url: `https://www.grants.gov/search-results-detail/${raw.id}`,
      application_url: `https://www.grants.gov/search-results-detail/${raw.id}`,
      status: raw.closeDate && new Date(raw.closeDate) < new Date() ? "expired" : "active",
      embedding: embeddings[i]?.length ? embeddings[i] : null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabaseAdmin.from("opportunities").upsert(row, { onConflict: "source,source_id" });
    if (error) { log(`  store error (${raw.id}): ${error.message}`); continue; }
    newCount++;
  }
  log(`Stored/updated ${newCount} | posted TODAY (${today}): ${postedToday}`);

  // ---- RE-MATCH every org with a usable profile ----
  log(`\n=== RE-MATCH all orgs ===`);
  const { data: orgs } = await supabaseAdmin
    .from("organizations").select("*").not("profile_embedding", "is", null).gte("profile_completeness", 30);
  for (const org of orgs ?? []) {
    const top = (await vectorSimilaritySearch(org.profile_embedding as unknown as number[], 100))
      .map(({ opportunity, similarity }) => ({ opportunity, similarity, composite: computeCompositeScore(org as never, opportunity as never, similarity) }))
      .filter((o) => o.composite >= 25)
      .sort((a, b) => b.composite - a.composite)
      .slice(0, 20);
    if (!top.length) { log(`  ${org.legal_name}: 0 matches`); continue; }
    const analyses = await batchAnalyzeMatches(org as never, top.map((o) => o.opportunity as never));
    const rows = top.map(({ opportunity, similarity, composite }) => {
      const a = analyses.get(opportunity.id);
      return {
        org_id: org.id, opportunity_id: opportunity.id, raw_similarity_score: similarity,
        match_score: a?.match_score ?? composite, success_probability: a?.success_probability ?? 0,
        match_reasons: a?.match_reasons ?? [], disqualifiers: a?.disqualifiers ?? [],
        recommended_action: a?.recommended_action ?? null, ai_analysis_at: a ? new Date().toISOString() : null, status: "new",
      };
    });
    await supabaseAdmin.from("matches").upsert(rows, { onConflict: "org_id,opportunity_id" });
    log(`  ${org.legal_name}: ${rows.length} matches`);
  }
  log(`\n=== DONE ===`);
}
main().catch((e) => { console.error("ERROR:", e); process.exit(1); });
