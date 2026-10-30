/**
 * Full re-embed of opportunities.embedding and organizations.profile_embedding
 * with the current local model (Ollama, EMBEDDING_MODEL, default bge-m3).
 * Required after switching models: vectors from different models live in
 * different spaces, so old and new vectors must never be compared.
 *
 * Walks each table in id order (keyset pagination) and checkpoints the last
 * processed id per table to STATE_FILE, so an interrupted run resumes where
 * it stopped. Delete the state file (or pass RESET=1) to start over.
 *
 * Run:     npx tsx scripts/reembed-all.ts
 * Options: TABLES=opportunities,organizations  (default: both)
 *          BATCH=32          rows embedded per Ollama request
 *          LIMIT=100         stop after N rows per table (smoke test)
 *          DRY_RUN=1         embed but don't write to the DB or checkpoint
 *          RESET=1           ignore/clear any existing checkpoint
 *          STATE_FILE=path   default: .reembed-state.json
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// .env.local is optional — in the worker container env comes from compose.
const envFile = resolve(process.cwd(), ".env.local");
for (const line of (existsSync(envFile) ? readFileSync(envFile, "utf8") : "").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const log = (...a: unknown[]) => console.log(...a);
const BATCH = Number(process.env.BATCH ?? 32);
const LIMIT = process.env.LIMIT ? Number(process.env.LIMIT) : Infinity;
const DRY_RUN = process.env.DRY_RUN === "1";
const STATE_FILE = resolve(process.cwd(), process.env.STATE_FILE ?? ".reembed-state.json");
const TABLES = (process.env.TABLES ?? "opportunities,organizations").split(",").map((t) => t.trim());

type State = Record<string, { lastId: string | null; done: boolean; updated: number; failed: number }>;

function loadState(): State {
  if (process.env.RESET === "1" && existsSync(STATE_FILE)) rmSync(STATE_FILE);
  if (!existsSync(STATE_FILE)) return {};
  return JSON.parse(readFileSync(STATE_FILE, "utf8")) as State;
}

function saveState(state: State) {
  if (!DRY_RUN) writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

async function main() {
  const { embedTexts, buildOpportunityEmbeddingText, buildOrgEmbeddingText } = await import("@/lib/embeddings");
  const { supabaseAdmin } = await import("@/lib/supabase/admin");

  const configs = {
    opportunities: {
      select: "id,title,description,funder_name,eligibility_types",
      column: "embedding",
      text: (row: Record<string, unknown>) => buildOpportunityEmbeddingText(row),
    },
    organizations: {
      select: "id,mission_statement,primary_focus_areas,target_beneficiaries,programs,annual_budget_range,geographic_service_area",
      column: "profile_embedding",
      text: (row: Record<string, unknown>) => buildOrgEmbeddingText(row),
    },
  } as const;

  const state = loadState();
  log(`Model: ${process.env.EMBEDDING_MODEL || "bge-m3"} @ ${process.env.OLLAMA_URL || "http://localhost:11434"}`);
  log(`Batch ${BATCH}${DRY_RUN ? " (DRY RUN — no writes)" : ""}; state file ${STATE_FILE}`);

  for (const table of TABLES) {
    const cfg = configs[table as keyof typeof configs];
    if (!cfg) throw new Error(`Unknown table "${table}" (expected opportunities|organizations)`);
    const st = (state[table] ??= { lastId: null, done: false, updated: 0, failed: 0 });
    if (st.done) { log(`\n[${table}] already complete (${st.updated} updated) — skipping. RESET=1 to redo.`); continue; }

    const { count } = await supabaseAdmin.from(table).select("id", { count: "exact", head: true });
    log(`\n[${table}] ${count ?? "?"} rows total; resuming after ${st.lastId ?? "start"}`);

    let processed = 0;
    while (processed < LIMIT) {
      let q = supabaseAdmin.from(table).select(cfg.select).order("id").limit(Math.min(BATCH, LIMIT - processed));
      if (st.lastId) q = q.gt("id", st.lastId);
      const { data, error } = await q;
      if (error) throw new Error(`[${table}] fetch failed: ${error.message}`);
      const rows = (data ?? []) as unknown as Array<Record<string, unknown> & { id: string }>;
      if (!rows.length) { st.done = true; break; }

      const t0 = Date.now();
      const embeddings = await embedTexts(rows.map(cfg.text));
      const embedMs = Date.now() - t0;

      // A batch where every embedding failed means Ollama is unreachable or
      // misconfigured — stop rather than skip past rows (checkpoint is intact).
      if (embeddings.every((e) => !e.length)) {
        throw new Error(`[${table}] all ${rows.length} embeddings in batch failed — is Ollama running? Re-run to resume.`);
      }

      let batchUpdated = 0;
      let batchFailed = 0;
      if (!DRY_RUN) {
        const results = await Promise.all(
          rows.map(async (row, i) => {
            // On failure, NULL the old vector rather than leave a stale
            // other-model vector behind; /api/cron/reembed backfills NULLs.
            const ok = embeddings[i].length > 0;
            const { error: upErr } = await supabaseAdmin
              .from(table).update({ [cfg.column]: ok ? embeddings[i] : null }).eq("id", row.id);
            if (upErr) console.error(`  ${table} ${row.id}: ${upErr.message}`);
            return ok && !upErr;
          }),
        );
        batchUpdated = results.filter(Boolean).length;
        batchFailed = results.length - batchUpdated;
      } else {
        batchUpdated = embeddings.filter((e) => e.length).length;
        batchFailed = rows.length - batchUpdated;
      }

      st.lastId = rows[rows.length - 1].id;
      st.updated += batchUpdated;
      st.failed += batchFailed;
      processed += rows.length;
      saveState(state);
      log(`  [${table}] +${batchUpdated}${batchFailed ? ` (${batchFailed} failed)` : ""} — embed ${embedMs}ms — total ${st.updated}/${count ?? "?"}`);
    }
    saveState(state);
    log(`[${table}] ${st.done ? "complete" : "paused (LIMIT reached)"}: ${st.updated} updated, ${st.failed} failed`);
  }

  if (TABLES.every((t) => state[t]?.done)) {
    log("\nAll tables re-embedded. Recompute matches next so match scores reflect the new vectors.");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
