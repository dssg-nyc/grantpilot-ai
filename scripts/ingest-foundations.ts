/**
 * Best-effort live ingestion of foundation/corporate grants via Firecrawl + AI extraction.
 * Scrapes FOUNDATION_TARGETS, extracts structured grants, embeds (batched), stores,
 * then re-matches the seeded org so they appear in the dashboard.
 * Run: npx tsx scripts/ingest-foundations.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const log = (...a: unknown[]) => console.log(...a);

async function main() {
  const { FOUNDATION_TARGETS, scrapeFoundation } = await import("@/lib/firecrawl/scrapers/foundation-scraper");
  const { embedTexts } = await import("@/lib/voyage/embeddings");
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const { vectorSimilaritySearch } = await import("@/lib/matching/vector-search");
  const { computeCompositeScore } = await import("@/lib/matching/score-calculator");
  const { batchAnalyzeMatches } = await import("@/lib/anthropic/match-analyzer");

  // ---- SCRAPE + EXTRACT (per target, so we can report yield) ----
  log(`\n=== SCRAPE + AI-EXTRACT ${FOUNDATION_TARGETS.length} foundation/corporate sources ===`);
  const allGrants: Awaited<ReturnType<typeof scrapeFoundation>> = [];
  for (const t of FOUNDATION_TARGETS) {
    try {
      const grants = await scrapeFoundation(t);
      log(`  ${grants.length.toString().padStart(2)} grants  <- ${t.name} (${t.funder_type})`);
      allGrants.push(...grants);
    } catch (e) {
      log(`   0 grants  <- ${t.name}  [error: ${String(e).slice(0, 60)}]`);
    }
  }
  log(`Total extracted: ${allGrants.length}`);
  if (!allGrants.length) {
    log("No foundation grants could be extracted from any source. (This is the expected domain limitation.)");
    return;
  }

  // ---- EMBED (batched) + STORE ----
  log(`\n=== EMBED (batched) + STORE ===`);
  const embeddings = await embedTexts(
    allGrants.map((g) => [g.title, g.description, `Funder: ${g.funder_name}`].join("\n")),
  );
  let stored = 0;
  for (let i = 0; i < allGrants.length; i++) {
    const g = allGrants[i];
    const sourceId = `firecrawl_${Buffer.from(g.title + g.funder_name).toString("base64").slice(0, 32)}`;
    let deadline: string | null = null;
    if (g.deadline) { const d = new Date(g.deadline); if (!isNaN(d.getTime())) deadline = d.toISOString().split("T")[0]; }
    const row = {
      title: g.title.slice(0, 500),
      description: g.description ?? "",
      funder_name: g.funder_name,
      funder_type: g.funder_type,
      funding_type: "grant",
      amount_min: g.amount_min,
      amount_max: g.amount_max,
      deadline,
      is_rolling_deadline: !deadline,
      eligibility_types: g.eligibility_types?.length ? g.eligibility_types : ["nonprofit_501c3"],
      focus_areas: g.focus_areas ?? [],
      geographic_scope: "national",
      geographic_states: [] as string[],
      source: "firecrawl",
      source_id: sourceId,
      source_url: g.source_url,
      application_url: g.application_url ?? g.source_url,
      status: deadline && new Date(deadline) < new Date() ? "expired" : "active",
      embedding: embeddings[i]?.length ? embeddings[i] : null,
      ai_enriched_at: new Date().toISOString(),
    };
    const { error } = await supabaseAdmin.from("opportunities").upsert(row, { onConflict: "source,source_id" });
    if (error) { log(`  store error (${g.title.slice(0, 30)}): ${error.message}`); continue; }
    stored++;
  }
  log(`Stored ${stored} foundation/corporate opportunities`);

  // ---- breakdown by funder_type ----
  const { data: breakdown } = await supabaseAdmin.from("opportunities").select("funder_type");
  const counts: Record<string, number> = {};
  for (const r of breakdown ?? []) counts[r.funder_type] = (counts[r.funder_type] ?? 0) + 1;
  log(`\nopportunities by funder_type:`, counts);

  // ---- RE-MATCH the seeded org so new grants surface ----
  const { data: org } = await supabaseAdmin.from("organizations").select("*").eq("ein", "00-0000001").single();
  if (!org?.profile_embedding) { log("No seeded org to re-match; skipping."); return; }
  log(`\n=== RE-MATCH org "${org.legal_name}" ===`);
  const orgEmbedding = org.profile_embedding as unknown as number[];
  const top = (await vectorSimilaritySearch(orgEmbedding, 100))
    .map(({ opportunity, similarity }) => ({ opportunity, similarity, composite: computeCompositeScore(org as never, opportunity as never, similarity) }))
    .filter((o) => o.composite >= 25)
    .sort((a, b) => b.composite - a.composite)
    .slice(0, 20);
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

  const { data: shown } = await supabaseAdmin.from("matches")
    .select("match_score, opportunity:opportunities(title, funder_name, funder_type)")
    .eq("org_id", org.id).order("match_score", { ascending: false });
  log(`\n=== TOP MATCHES NOW (mixed funder types) ===`);
  for (const m of shown ?? []) {
    const o = m.opportunity as unknown as { title: string; funder_name: string; funder_type: string };
    log(`  [${m.match_score}] (${o.funder_type}) ${o.title.slice(0, 55)} — ${o.funder_name}`);
  }
}
main().catch((e) => { console.error("ERROR:", e); process.exit(1); });
