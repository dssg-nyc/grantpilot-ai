/**
 * Recompute matches for a single org against the current opportunity pool.
 * Run: ORG_ID=<uuid> npx tsx scripts/match-org.ts
 *      (or pass the org id as the first CLI arg)
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const ORG_ID = process.env.ORG_ID ?? process.argv[2];
const log = (...a: unknown[]) => console.log(...a);

async function main() {
  if (!ORG_ID) throw new Error("Provide ORG_ID env or arg");
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const { computeMatchRowsForOrg } = await import("@/lib/matching/compute");

  const { data: org, error } = await supabaseAdmin
    .from("organizations").select("*").eq("id", ORG_ID).single();
  if (error || !org) throw new Error("Org not found: " + (error?.message ?? ORG_ID));
  if (!org.profile_embedding) throw new Error(`Org ${org.legal_name} has no embedding`);

  log(`Matching "${org.legal_name}" (completeness ${org.profile_completeness})...`);
  const rows = await computeMatchRowsForOrg(org as never, { analyzeTop: 10 });
  if (!rows.length) {
    log("0 matches above threshold — the current opportunity pool may not fit this org's focus.");
    return;
  }
  const { error: upErr } = await supabaseAdmin
    .from("matches").upsert(rows, { onConflict: "org_id,opportunity_id" });
  if (upErr) throw new Error("Upsert failed: " + upErr.message);

  log(`Stored ${rows.length} matches:`);
  for (const r of rows.slice(0, 10)) {
    log(`  [${r.match_score}] prob=${r.success_probability}% conf=${r.analysis_confidence ?? "n/a"}`);
  }
}

main().catch((e) => { console.error("ERROR:", e); process.exit(1); });
