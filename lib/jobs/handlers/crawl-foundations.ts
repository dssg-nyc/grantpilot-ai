import { supabaseAdmin } from "@/lib/supabase/admin";
import { embedTexts } from "@/lib/embeddings";
import { scrapeAllFoundations } from "@/lib/scraper/foundation-scraper";
import type { JobHandler } from "@/lib/jobs/handlers/types";

/** "crawl-foundations" — daily scrape of foundation & corporate grant pages. */
export const crawlFoundations: JobHandler<"crawl-foundations"> = async (_data, ctx) => {
  const grants = await scrapeAllFoundations();
  if (!grants.length) return { ok: true, ingested: 0 };

  // Embed every scraped grant in ONE batched request.
  const embeddings = await embedTexts(
    grants.map((g) => [g.title, g.description, `Funder: ${g.funder_name}`].join("\n")),
  );

  let count = 0;
  const errors: string[] = [];
  for (let i = 0; i < grants.length; i++) {
    const grant = grants[i];
    try {
      // "firecrawl" source/prefix kept as-is: it's part of the (source, source_id)
      // upsert key, so renaming it would duplicate every existing foundation grant.
      const sourceId = `firecrawl_${Buffer.from(grant.title + grant.funder_name).toString("base64").slice(0, 32)}`;

      let deadline: string | null = null;
      if (grant.deadline) {
        const d = new Date(grant.deadline);
        if (!isNaN(d.getTime())) deadline = d.toISOString().split("T")[0];
      }

      const embedding = embeddings[i] ?? [];
      // Upsert by (source, source_id) — idempotent across runs.
      const { error } = await supabaseAdmin.from("opportunities").upsert(
        {
          title: grant.title.slice(0, 500),
          description: grant.description ?? "",
          funder_name: grant.funder_name,
          funder_type: grant.funder_type,
          funding_type: "grant",
          amount_min: grant.amount_min,
          amount_max: grant.amount_max,
          deadline,
          is_rolling_deadline: !deadline,
          eligibility_types: grant.eligibility_types?.length ? grant.eligibility_types : ["nonprofit_501c3"],
          focus_areas: grant.focus_areas ?? [],
          geographic_scope: "national",
          geographic_states: [],
          source: "firecrawl",
          source_id: sourceId,
          source_url: grant.source_url,
          application_url: grant.application_url ?? grant.source_url,
          status: deadline && new Date(deadline) < new Date() ? "expired" : "active",
          embedding: embedding.length > 0 ? embedding : null,
          ai_enriched_at: new Date().toISOString(),
        },
        { onConflict: "source,source_id" },
      );
      if (error) { errors.push(`${grant.title}: ${error.message}`); continue; }
      count++;
    } catch (e) {
      errors.push(`${grant.title}: ${e}`);
    }
  }

  // Surface new grants to the matcher.
  if (count > 0) {
    await ctx.enqueue("grants/new-opportunities", { count, source: "firecrawl" });
  }

  return { ok: true, count, total: grants.length, errors: errors.slice(0, 5) };
};
