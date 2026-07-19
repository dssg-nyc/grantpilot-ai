/**
 * One-time backfill: classify focus_areas (and, where missing, ai_summary)
 * for opportunities ingested before sync-grants-gov.ts actually classified
 * them (it previously hardcoded focus_areas: []). Every active opportunity
 * ingested before 2026-07-19 has focus_areas='{}' and ai_summary=NULL —
 * confirmed via direct DB query, not an assumption.
 *
 * Run: npx tsx scripts/backfill-focus-areas.ts
 * Optional: LIMIT=50 npx tsx scripts/backfill-focus-areas.ts  (smoke test)
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const log = (...a: unknown[]) => console.log(...a);

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

async function main() {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const { FOCUS_AREA_TAXONOMY } = await import("@/lib/utils/taxonomy");
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const limit = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : undefined;

  let query = supabaseAdmin
    .from("opportunities")
    .select("id, title, description")
    .eq("status", "active")
    .or("focus_areas.is.null,focus_areas.eq.{}")
    .order("created_at", { ascending: false });
  if (limit) query = query.limit(limit);

  const { data: rows, error } = await query;
  if (error) throw new Error("Fetch failed: " + error.message);
  if (!rows?.length) {
    log("Nothing to backfill — no active opportunities with empty focus_areas.");
    return;
  }
  log(`Backfilling ${rows.length} opportunities...`);

  const validAreas = new Set<string>(FOCUS_AREA_TAXONOMY);

  async function classify(row: { id: string; title: string; description: string | null }) {
    const description = row.description ?? "";
    if (!description.trim()) return { id: row.id, summary: "", focusAreas: [] as string[] };
    try {
      const resp = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 250,
        messages: [
          {
            role: "user",
            content: `You are classifying a US grant opportunity for a nonprofit funding platform. Respond in valid JSON only, no preamble.

Title: ${row.title}

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
      const focusAreas = Array.isArray(parsed.focus_areas)
        ? parsed.focus_areas.filter((a: unknown): a is string => typeof a === "string" && validAreas.has(a))
        : [];
      return {
        id: row.id,
        summary: typeof parsed.summary === "string" ? parsed.summary.trim() : "",
        focusAreas,
      };
    } catch (err) {
      log(`  classify failed for ${row.id}:`, err instanceof Error ? err.message : err);
      return { id: row.id, summary: "", focusAreas: [] as string[] };
    }
  }

  let processed = 0;
  let updated = 0;
  const BATCH = 50;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const results = await mapWithConcurrency(batch, 8, classify);

    for (const r of results) {
      processed++;
      if (!r.focusAreas.length && !r.summary) continue;
      const updatePayload: Record<string, unknown> = {};
      if (r.focusAreas.length) updatePayload.focus_areas = r.focusAreas;
      if (r.summary) {
        updatePayload.ai_summary = r.summary;
        updatePayload.ai_enriched_at = new Date().toISOString();
      }
      const { error: updErr } = await supabaseAdmin
        .from("opportunities")
        .update(updatePayload)
        .eq("id", r.id);
      if (updErr) {
        log(`  update failed for ${r.id}:`, updErr.message);
      } else {
        updated++;
      }
    }
    log(`  ${processed}/${rows.length} processed, ${updated} updated`);
  }

  log(`Done. ${updated}/${rows.length} opportunities updated with focus_areas/summary.`);
}

main().catch((e) => {
  console.error("ERROR:", e);
  process.exit(1);
});
