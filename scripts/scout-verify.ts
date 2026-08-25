/**
 * Verifies the Funding Scout's non-LLM path against the real database: the
 * exact recordFinding() validator the agent's tool calls flow through, the
 * scout_runs/scout_findings schema, and the ranked read-back the API serves.
 *
 * Feeds it deliberately messy, model-shaped input (junk URLs, "$50,000" in a
 * number field, an out-of-range score, an off-taxonomy focus area) to prove
 * the normalizer holds. Makes zero Anthropic API calls, so it runs even when
 * the account is over its spend limit.
 *
 * Run: ORG_ID=<uuid> npx tsx scripts/scout-verify.ts
 *      KEEP=1 ORG_ID=<uuid> npx tsx scripts/scout-verify.ts   (leave the run in place for UI testing)
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const ORG_ID = process.env.ORG_ID ?? process.argv[2];
const KEEP = process.env.KEEP === "1";

let passed = 0;
let failed = 0;
function check(label: string, condition: boolean, detail?: unknown) {
  if (condition) {
    passed++;
    console.log(`  PASS  ${label}`);
  } else {
    failed++;
    console.log(`  FAIL  ${label}${detail !== undefined ? ` — got ${JSON.stringify(detail)}` : ""}`);
  }
}

async function main() {
  if (!ORG_ID) throw new Error("Provide ORG_ID env or arg");

  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const { recordFinding } = await import("@/lib/anthropic/scout/record-finding");

  const { data: org, error: orgError } = await supabaseAdmin
    .from("organizations")
    .select("id, legal_name")
    .eq("id", ORG_ID)
    .single();
  if (orgError || !org) throw new Error("Org not found: " + (orgError?.message ?? ORG_ID));

  const { data: run, error: runError } = await supabaseAdmin
    .from("scout_runs")
    .insert({
      org_id: ORG_ID,
      scope: "project",
      project_name: "Verification run",
      project_description: "Synthetic run exercising recordFinding validation.",
      target_count: 5,
      status: "running",
    })
    .select()
    .single();
  if (runError || !run) throw new Error("Failed to create run: " + runError?.message);

  console.log(`\nOrg: ${org.legal_name}`);
  console.log(`Run: ${run.id}\n`);

  const ctx = { supabase: supabaseAdmin, runId: run.id, orgId: ORG_ID };

  console.log("Rejections (bad input must NOT reach the database):");

  const noUrl = await recordFinding({
    ...ctx,
    input: { title: "Grant with no source", funder_name: "Someone", fit_score: 90, fit_rationale: "..." },
  });
  check("missing source_url is rejected", !!noUrl.error && !noUrl.finding);

  const relUrl = await recordFinding({
    ...ctx,
    input: { title: "Relative URL", funder_name: "Someone", source_url: "/grants/apply", fit_score: 80, fit_rationale: "..." },
  });
  check("non-absolute source_url is rejected", !!relUrl.error && !relUrl.finding);

  const jsUrl = await recordFinding({
    ...ctx,
    input: { title: "Script URL", funder_name: "Someone", source_url: "javascript:alert(1)", fit_score: 80, fit_rationale: "..." },
  });
  check("non-http(s) scheme is rejected", !!jsUrl.error && !jsUrl.finding);

  const noTitle = await recordFinding({
    ...ctx,
    input: { funder_name: "Someone", source_url: "https://example.org/g", fit_score: 50, fit_rationale: "..." },
  });
  check("missing title is rejected", !!noTitle.error && !noTitle.finding);

  console.log("\nNormalization (messy-but-usable model output must be coerced, not dropped):");

  const messy = await recordFinding({
    ...ctx,
    input: {
      title: "  Community Resilience Fund  ",
      funder_name: "Example Community Foundation",
      funder_type: "not_a_real_type",
      source_url: "https://example.org/grants/community-resilience",
      application_url: "not a url at all",
      program_summary: "Supports neighborhood-level resilience projects.",
      amount_min: "$25,000",
      amount_max: 100000,
      deadline: "March 14, 2027",
      eligibility_summary: "501(c)(3) organizations in the tri-state area.",
      focus_areas: ["Community Development", "Totally Made Up Area", "Environment & Climate"],
      fit_score: 137,
      fit_rationale: "Geographic and mission alignment are strong.",
      concerns: ["Requires 1:1 match", "Page last updated 2024"],
      evidence_confidence: "extremely-high",
      already_in_database: "yes",
    },
  });

  const f = messy.finding;
  check("messy-but-valid input is accepted", !!f, messy.error);
  if (f) {
    check("title is trimmed", f.title === "Community Resilience Fund", f.title);
    check("unknown funder_type falls back to 'other'", f.funder_type === "other", f.funder_type);
    check("unparseable application_url is dropped, not stored", f.application_url === null, f.application_url);
    check('"$25,000" string coerces to 25000', f.amount_min === 25000, f.amount_min);
    check("prose date coerces to ISO", f.deadline === "2027-03-14", f.deadline);
    check("off-taxonomy focus area is filtered out", f.focus_areas.length === 2, f.focus_areas);
    check("fit_score clamps to 100", f.fit_score === 100, f.fit_score);
    check("invalid confidence falls back to 'medium'", f.evidence_confidence === "medium", f.evidence_confidence);
    check("non-boolean already_in_database is not truthy-coerced", f.already_in_database === false, f.already_in_database);
    check("concerns survive intact", f.concerns.length === 2, f.concerns);
  }

  console.log("\nClean findings (the normal path):");
  const clean = [
    {
      title: "Youth Data Literacy Initiative",
      funder_name: "Hypothetical Family Foundation",
      funder_type: "foundation",
      source_url: "https://example.org/programs/youth-data-literacy",
      application_url: "https://example.org/apply",
      program_summary: "Two-year grants for organizations teaching data skills to teenagers.",
      amount_min: 50000,
      amount_max: 150000,
      deadline: "2027-01-31",
      eligibility_summary: "501(c)(3) with at least two years of operating history.",
      geographic_eligibility: "New York State",
      focus_areas: ["Education", "Technology & Digital Equity", "Youth Development"],
      fit_score: 82,
      fit_rationale: "Directly matches the org's data-education work and NYC service area.",
      concerns: ["Requires two years of audited financials"],
      evidence_confidence: "high",
    },
    {
      title: "Neighborhood Tech Access Micro-Grants",
      funder_name: "Hypothetical City Council",
      funder_type: "local_government",
      source_url: "https://example.gov/microgrants",
      program_summary: "Small awards for closing the digital divide at the block level.",
      amount_max: 15000,
      deadline_note: "Rolling, reviewed quarterly",
      focus_areas: ["Technology & Digital Equity"],
      fit_score: 46,
      fit_rationale: "On-theme but far below the org's typical grant size.",
      concerns: ["Award size may not cover staff time", "City residency requirement unclear"],
      evidence_confidence: "medium",
    },
  ];
  for (const input of clean) {
    const r = await recordFinding({ ...ctx, input });
    check(`recorded: ${input.title}`, !!r.finding, r.error);
  }

  console.log("\nRead-back (what the API route serves):");
  const { data: rows, error: readError } = await supabaseAdmin
    .from("scout_findings")
    .select("*")
    .eq("run_id", run.id)
    .order("fit_score", { ascending: false });
  check("read-back succeeds", !readError, readError?.message);
  check("only valid findings persisted (4 recorded, 4 rejected)", rows?.length === 3, rows?.length);
  check("ranked by fit_score descending", !!rows && rows.every((r, i) => i === 0 || rows[i - 1].fit_score >= r.fit_score));
  check("every persisted finding has a usable source_url", !!rows && rows.every((r) => /^https?:\/\//.test(r.source_url)));

  await supabaseAdmin
    .from("scout_runs")
    .update({
      status: "completed",
      finding_count: rows?.length ?? 0,
      summary: "Synthetic verification run — no live web research was performed.",
      completed_at: new Date().toISOString(),
    })
    .eq("id", run.id);

  if (!KEEP) {
    await supabaseAdmin.from("scout_runs").delete().eq("id", run.id);
    const { count } = await supabaseAdmin
      .from("scout_findings")
      .select("id", { count: "exact", head: true })
      .eq("run_id", run.id);
    check("deleting the run cascades to its findings", (count ?? 0) === 0, count);
  } else {
    console.log(`\nKept run ${run.id} for UI testing.`);
  }

  console.log(`\n--- ${passed} passed, ${failed} failed ---`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
