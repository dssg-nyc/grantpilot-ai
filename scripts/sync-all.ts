/**
 * Unified ingestion: pull EVERY source in one run, then recompute matches once.
 *   - Federal:            grants.gov (dated, daily-fresh)
 *   - Foundation/Corporate: Firecrawl scrape of FOUNDATION_TARGETS
 * This is the single "pull all kinds of grants" entrypoint for local/manual runs.
 * In deployment the two Inngest crons cover the same sources on their own cadence.
 * Run: npx tsx scripts/sync-all.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const log = (...a: unknown[]) => console.log(...a);
const FED_COUNT = Number(process.env.FED_COUNT ?? 40);

const eligMap: Record<string, string> = {
  "25": "nonprofit_501c3", "20": "educational", "12": "government", "11": "government", "21": "individual",
};
const parseElig = (raw?: string[]) => (!raw?.length ? ["any"] : raw.map((e) => eligMap[e] ?? "nonprofit_other"));
const toISO = (d?: string | null) => { if (!d) return null; const t = new Date(d); return isNaN(t.getTime()) ? null : t.toISOString().split("T")[0]; };

async function main() {
  const { fetchGrantsGovOpportunities, fetchGrantDetails } = await import("@/lib/data-sources/grants-gov");
  const { scrapeAllFoundations } = await import("@/lib/firecrawl/scrapers/foundation-scraper");
  const { embedTexts } = await import("@/lib/voyage/embeddings");
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const { computeMatchRowsForOrg } = await import("@/lib/matching/compute");

  const upsert = (row: Record<string, unknown>) =>
    supabaseAdmin.from("opportunities").upsert(row, { onConflict: "source,source_id" });

  // ============ SOURCE 1: FEDERAL (grants.gov) ============
  log(`\n=== [1/3] FEDERAL — grants.gov (${FED_COUNT} newest) ===`);
  const fed = await fetchGrantsGovOpportunities(0, FED_COUNT);
  const fedEnriched = [];
  for (const raw of fed) {
    const d = await fetchGrantDetails(String(raw.id));
    fedEnriched.push({ raw, d, description: d.description ?? "", elig: parseElig(d.eligibilities) });
  }
  const fedEmb = await embedTexts(
    fedEnriched.map((e) => [e.raw.title, e.description, `Funder: ${e.raw.agency ?? "Federal Agency"}`, `Eligibility: ${e.elig.join(", ")}`].join("\n")),
  );
  let fedStored = 0;
  for (let i = 0; i < fedEnriched.length; i++) {
    const { raw, d, description, elig } = fedEnriched[i];
    const min = d.awardFloor ? parseInt(d.awardFloor) : null;
    const max = d.awardCeiling ? parseInt(d.awardCeiling) : null;
    const { error } = await upsert({
      title: raw.title, description, funder_name: raw.agency ?? "Federal Agency",
      funder_type: "federal_government", funding_type: "grant",
      amount_min: Number.isNaN(min as number) ? null : min, amount_max: Number.isNaN(max as number) ? null : max,
      deadline: toISO(raw.closeDate), posted_date: toISO(raw.openDate), is_rolling_deadline: !raw.closeDate,
      eligibility_types: elig, focus_areas: [], geographic_scope: "national", geographic_states: [],
      source: "grants_gov", source_id: String(raw.id),
      source_url: `https://www.grants.gov/search-results-detail/${raw.id}`,
      application_url: `https://www.grants.gov/search-results-detail/${raw.id}`,
      status: raw.closeDate && new Date(raw.closeDate) < new Date() ? "expired" : "active",
      embedding: fedEmb[i]?.length ? fedEmb[i] : null, updated_at: new Date().toISOString(),
    });
    if (!error) fedStored++;
  }
  log(`  federal stored/updated: ${fedStored}`);

  // ============ SOURCE 2 & 3: FOUNDATION + CORPORATE (Firecrawl) ============
  log(`\n=== [2/3] FOUNDATION + CORPORATE — Firecrawl scrape ===`);
  const grants = await scrapeAllFoundations();
  log(`  scraped/extracted: ${grants.length}`);
  let scrapedStored = 0;
  if (grants.length) {
    const emb = await embedTexts(grants.map((g) => [g.title, g.description, `Funder: ${g.funder_name}`].join("\n")));
    for (let i = 0; i < grants.length; i++) {
      const g = grants[i];
      const sourceId = `firecrawl_${Buffer.from(g.title + g.funder_name).toString("base64").slice(0, 32)}`;
      const deadline = toISO(g.deadline);
      const { error } = await upsert({
        title: g.title.slice(0, 500), description: g.description ?? "", funder_name: g.funder_name,
        funder_type: g.funder_type, funding_type: "grant", amount_min: g.amount_min, amount_max: g.amount_max,
        deadline, is_rolling_deadline: !deadline,
        eligibility_types: g.eligibility_types?.length ? g.eligibility_types : ["nonprofit_501c3"],
        focus_areas: g.focus_areas ?? [], geographic_scope: "national", geographic_states: [],
        source: "firecrawl", source_id: sourceId, source_url: g.source_url,
        application_url: g.application_url ?? g.source_url,
        status: deadline && new Date(deadline) < new Date() ? "expired" : "active",
        embedding: emb[i]?.length ? emb[i] : null, ai_enriched_at: new Date().toISOString(),
      });
      if (!error) scrapedStored++;
    }
  }
  log(`  foundation/corporate stored/updated: ${scrapedStored}`);

  // ============ MATCH (once, across all new data) ============
  log(`\n=== [3/3] RE-MATCH all orgs ===`);
  const { data: orgs } = await supabaseAdmin
    .from("organizations").select("*").not("profile_embedding", "is", null).gte("profile_completeness", 30);
  for (const org of orgs ?? []) {
    const rows = await computeMatchRowsForOrg(org as never, { analyzeTop: 10 });
    if (!rows.length) { log(`  ${org.legal_name}: 0`); continue; }
    await supabaseAdmin.from("matches").upsert(rows, { onConflict: "org_id,opportunity_id" });
    log(`  ${org.legal_name}: ${rows.length} matches`);
  }

  // ---- summary ----
  const { data: counts } = await supabaseAdmin.from("opportunities").select("funder_type").eq("status", "active");
  const by: Record<string, number> = {};
  for (const r of counts ?? []) by[r.funder_type] = (by[r.funder_type] ?? 0) + 1;
  log(`\n=== DONE — active opportunities by type:`, by, `===`);
}
main().catch((e) => { console.error("ERROR:", e); process.exit(1); });
