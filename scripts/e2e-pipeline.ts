/**
 * End-to-end pipeline proof: fetch -> store -> match -> show.
 * Drives the REAL lib modules (same code the Inngest functions use).
 * Run: npx tsx scripts/e2e-pipeline.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ---- load .env.local before importing anything that reads process.env ----
for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const GRANT_LIMIT = Number(process.env.GRANT_LIMIT ?? 25);
const log = (...a: unknown[]) => console.log(...a);
const stripHtml = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

const eligMap: Record<string, string> = {
  "25": "nonprofit_501c3", "20": "educational", "12": "government",
  "11": "government", "21": "individual",
};
const parseElig = (raw?: string[]) =>
  !raw?.length ? ["any"] : raw.map((e) => eligMap[e] ?? "nonprofit_other");

async function main() {
  const { fetchGrantsGovOpportunities, fetchGrantDetails } = await import("@/lib/data-sources/grants-gov");
  const { embedTexts } = await import("@/lib/voyage/embeddings");
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const { vectorSimilaritySearch } = await import("@/lib/matching/vector-search");
  const { computeCompositeScore } = await import("@/lib/matching/score-calculator");
  const { batchAnalyzeMatches } = await import("@/lib/anthropic/match-analyzer");

  // ================= STAGE 1: FETCH =================
  log(`\n=== STAGE 1: FETCH (grants.gov, up to ${GRANT_LIMIT}) ===`);
  const list = await fetchGrantsGovOpportunities(0, GRANT_LIMIT);
  log(`Fetched ${list.length} opportunities from search endpoint`);
  if (!list.length) throw new Error("FETCH FAILED: no opportunities returned");

  // ================= STAGE 2: ENRICH + EMBED + STORE =================
  log(`\n=== STAGE 2: ENRICH (details) + EMBED (voyage) + STORE (supabase) ===`);

  // 2a. Pull details for every opp (grants.gov, not rate-limited like Voyage).
  const enriched = [];
  for (const raw of list) {
    const details = await fetchGrantDetails(String(raw.id));
    const description = details.description ?? "";
    const agency = raw.agency ?? "Federal Agency";
    const elig = parseElig(details.eligibilities);
    enriched.push({ raw, details, description, agency, elig });
  }

  // 2b. Embed ALL texts (opps + org mission) in ONE batched Voyage request.
  const mission = "We are a 501(c)(3) nonprofit improving rural and community health outcomes by building integrated health networks, expanding access to primary care, and supporting underserved populations across the United States.";
  const embedInputs = enriched.map((e) =>
    [e.raw.title, e.description, `Funder: ${e.agency}`, `Eligibility: ${e.elig.join(", ")}`].join("\n"),
  );
  embedInputs.push(mission);
  log(`Embedding ${embedInputs.length} texts in one batched request...`);
  const allEmbeddings = await embedTexts(embedInputs);
  const orgEmbedding = allEmbeddings[allEmbeddings.length - 1];

  let stored = 0, withDesc = 0, withAmount = 0, withEmbedding = 0;
  for (let i = 0; i < enriched.length; i++) {
    const { raw, details, description, agency, elig } = enriched[i];
    const embedding = allEmbeddings[i];
    const amountMin = details.awardFloor ? parseInt(details.awardFloor) : null;
    const amountMax = details.awardCeiling ? parseInt(details.awardCeiling) : null;

    const row = {
      title: raw.title,
      description,
      funder_name: agency,
      funder_type: "federal_government",
      funding_type: "grant",
      amount_min: Number.isNaN(amountMin as number) ? null : amountMin,
      amount_max: Number.isNaN(amountMax as number) ? null : amountMax,
      deadline: raw.closeDate ? new Date(raw.closeDate).toISOString().split("T")[0] : null,
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
      embedding: embedding.length ? embedding : null,
    };

    const { data: existing } = await supabaseAdmin.from("opportunities")
      .select("id").eq("source_id", String(raw.id)).eq("source", "grants_gov").maybeSingle();
    if (existing) {
      await supabaseAdmin.from("opportunities").update(row).eq("id", existing.id);
    } else {
      const { error } = await supabaseAdmin.from("opportunities").insert(row);
      if (error) { log("  insert error:", error.message); continue; }
    }
    stored++;
    if (description) withDesc++;
    if (amountMax || amountMin) withAmount++;
    if (embedding.length) withEmbedding++;
  }
  log(`Stored ${stored} | with description: ${withDesc} | with amount: ${withAmount} | with embedding: ${withEmbedding}`);

  const { count: oppCount } = await supabaseAdmin.from("opportunities").select("*", { count: "exact", head: true });
  log(`opportunities table now has ${oppCount} active rows`);

  // ================= SEED ORG =================
  log(`\n=== SEED TEST ORG (rural/community health nonprofit) ===`);
  if (!orgEmbedding?.length) throw new Error("ORG EMBED FAILED: empty embedding");
  await supabaseAdmin.from("organizations").delete().eq("ein", "00-0000001");
  const { data: org, error: orgErr } = await supabaseAdmin.from("organizations").insert({
    legal_name: "Rural Health Access Coalition",
    org_type: "nonprofit",
    ein: "00-0000001",
    is_501c3: true,
    mission_statement: mission,
    primary_focus_areas: ["health", "community_development"],
    secondary_focus_areas: ["education"],
    service_states: ["CA", "TX", "MS", "AL"],
    geographic_service_area: "national",
    annual_budget_range: "250k_1m",
    profile_embedding: orgEmbedding,
    profile_completeness: 85,
  }).select("*").single();
  if (orgErr) throw new Error("ORG SEED FAILED: " + orgErr.message);
  log(`Seeded org ${org.id} (${org.legal_name}), embedding dims=${orgEmbedding.length}`);

  // ================= STAGE 3: MATCH =================
  log(`\n=== STAGE 3: MATCH (vector search + composite score + AI analysis) ===`);
  const topOpps = await vectorSimilaritySearch(orgEmbedding, 100);
  log(`Vector search returned ${topOpps.length} candidate opportunities (threshold 0.3)`);

  const scored = topOpps
    .map(({ opportunity, similarity }) => ({
      opportunity, similarity,
      composite: computeCompositeScore(org as never, opportunity as never, similarity),
    }))
    .filter((o) => o.composite >= 25)
    .sort((a, b) => b.composite - a.composite);
  log(`${scored.length} passed scoring (composite >= 25)`);
  if (!scored.length) throw new Error("MATCH FAILED: no opportunities scored above threshold");

  const top = scored.slice(0, 5);
  log(`Running AI deep analysis on top ${top.length} via Anthropic...`);
  const analyses = await batchAnalyzeMatches(org as never, top.map((o) => o.opportunity as never));

  const matchRows = top.map(({ opportunity, similarity, composite }) => {
    const a = analyses.get(opportunity.id);
    return {
      org_id: org.id,
      opportunity_id: opportunity.id,
      raw_similarity_score: similarity,
      match_score: a?.match_score ?? composite,
      success_probability: a?.success_probability ?? 0,
      match_reasons: a?.match_reasons ?? [],
      disqualifiers: a?.disqualifiers ?? [],
      recommended_action: a?.recommended_action ?? null,
      ai_analysis_at: a ? new Date().toISOString() : null,
      status: "new",
    };
  });
  const { error: matchErr } = await supabaseAdmin.from("matches")
    .upsert(matchRows, { onConflict: "org_id,opportunity_id" });
  if (matchErr) throw new Error("MATCH UPSERT FAILED: " + matchErr.message);
  log(`Stored ${matchRows.length} matches`);

  // ================= STAGE 4: SHOW =================
  log(`\n=== STAGE 4: SHOW (read back what the dashboard API would return) ===`);
  const { data: shown } = await supabaseAdmin.from("matches")
    .select("match_score, success_probability, recommended_action, opportunity:opportunities(title, funder_name, amount_max, deadline, ai_summary)")
    .eq("org_id", org.id).order("match_score", { ascending: false });

  for (const m of shown ?? []) {
    const o = m.opportunity as unknown as { title: string; funder_name: string; amount_max: number | null; deadline: string | null };
    log(`\n  [${m.match_score}] ${o.title}`);
    log(`     Funder: ${o.funder_name} | Max: ${o.amount_max ? "$" + o.amount_max.toLocaleString() : "n/a"} | Deadline: ${o.deadline ?? "rolling"}`);
    log(`     Success prob: ${m.success_probability}% | Action: ${m.recommended_action ?? "n/a"}`);
  }
  log(`\n=== PIPELINE COMPLETE: fetch -> store -> match -> show all verified ===`);
}

main().catch((e) => { console.error("\nPIPELINE ERROR:", e); process.exit(1); });
