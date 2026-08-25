/**
 * Drive a real Funding Scout research run against a real org, bypassing HTTP
 * and auth — the same "test the library directly" pattern as match-org.ts.
 * Exercises the actual production code path: system prompt -> agent loop ->
 * web search/fetch -> record_funding_opportunity -> scout_findings rows.
 *
 * Run: ORG_ID=<uuid> npx tsx scripts/scout-run.ts
 *      ORG_ID=<uuid> PROJECT="After-school coding club for Bronx teens" npx tsx scripts/scout-run.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const ORG_ID = process.env.ORG_ID ?? process.argv[2];
const PROJECT = process.env.PROJECT;
const TARGET = Number(process.env.TARGET ?? 5);

async function main() {
  if (!ORG_ID) throw new Error("Provide ORG_ID env or arg");

  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const { runScout } = await import("@/lib/anthropic/scout/run-scout");
  const { buildScoutSystemPrompt } = await import("@/lib/anthropic/scout/system-prompt");
  const { data: org, error } = await supabaseAdmin
    .from("organizations")
    .select("*")
    .eq("id", ORG_ID)
    .single();
  if (error || !org) throw new Error("Org not found: " + (error?.message ?? ORG_ID));

  const request = {
    scope: (PROJECT ? "project" : "organization") as "project" | "organization",
    project_name: PROJECT,
    project_description: PROJECT,
    target_count: TARGET,
    funder_types: [],
  };

  const { data: run, error: runError } = await supabaseAdmin
    .from("scout_runs")
    .insert({
      org_id: ORG_ID,
      scope: request.scope,
      project_name: request.project_name ?? null,
      project_description: request.project_description ?? null,
      target_count: TARGET,
      status: "running",
    })
    .select()
    .single();
  if (runError || !run) throw new Error("Failed to create run: " + runError?.message);

  console.log(`\nScouting funding for "${org.legal_name}"`);
  console.log(`Scope: ${request.scope}${PROJECT ? ` — ${PROJECT}` : ""}`);
  console.log(`Run id: ${run.id}\n`);

  const systemPrompt = buildScoutSystemPrompt(org as never, request);
  const started = Date.now();
  let summary = "";
  let findings = 0;
  let searches = 0;
  let failure: string | null = null;

  for await (const event of runScout(systemPrompt, {
    supabase: supabaseAdmin,
    runId: run.id,
    orgId: ORG_ID,
  })) {
    if (event.type === "activity") {
      console.log(`  · ${event.label}${event.detail ? ` — ${event.detail.slice(0, 100)}` : ""}`);
    } else if (event.type === "finding") {
      findings++;
      const f = event.finding;
      console.log(`\n  [${f.fit_score}] ${f.title}`);
      console.log(`      ${f.funder_name} (${f.funder_type}) · ${f.evidence_confidence} confidence`);
      console.log(`      ${f.source_url}`);
      if (f.concerns.length) console.log(`      concerns: ${f.concerns.join(" | ")}`);
      console.log("");
    } else if (event.type === "summary_delta") {
      process.stdout.write(event.text);
    } else if (event.type === "error") {
      failure = event.message;
      console.error(`\n  ERROR: ${event.message}`);
    } else if (event.type === "done") {
      summary = event.summary;
      searches = event.searchesUsed;
    }
  }

  await supabaseAdmin
    .from("scout_runs")
    .update({
      status: failure ? "failed" : "completed",
      summary: summary.trim() || null,
      error: failure,
      finding_count: findings,
      searches_used: searches,
      completed_at: new Date().toISOString(),
    })
    .eq("id", run.id);

  const { data: persisted } = await supabaseAdmin
    .from("scout_findings")
    .select("title, fit_score, source_url, evidence_confidence")
    .eq("run_id", run.id)
    .order("fit_score", { ascending: false });

  console.log(`\n\n--- Run complete in ${Math.round((Date.now() - started) / 1000)}s ---`);
  console.log(`Findings streamed: ${findings} | persisted in DB: ${persisted?.length ?? 0} | web searches: ${searches}`);
  for (const f of persisted ?? []) {
    console.log(`  ${String(f.fit_score).padStart(3)} | ${f.evidence_confidence.padEnd(6)} | ${f.title}`);
    console.log(`      ${f.source_url}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
