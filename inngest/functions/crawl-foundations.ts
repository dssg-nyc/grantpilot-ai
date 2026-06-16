import { inngest } from "@/inngest/client";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { embedTexts } from "@/lib/voyage/embeddings";
import { scrapeAllFoundations } from "@/lib/firecrawl/scrapers/foundation-scraper";

export const crawlFoundations = inngest.createFunction(
  { id: "crawl-foundations", name: "Crawl Foundation & Corporate Grants", concurrency: { limit: 1 }, triggers: [{ cron: "0 6 * * *" }] },
  async ({ step }) => {
    const grants = await step.run("scrape-foundations", async () => {
      return scrapeAllFoundations();
    });

    if (!grants.length) return { ok: true, ingested: 0 };

    const ingested = await step.run("embed-and-store", async () => {
      // Embed every scraped grant in ONE batched Voyage request (avoids 429s).
      const embeddings = await embedTexts(
        grants.map((g) => [g.title, g.description, `Funder: ${g.funder_name}`].join("\n")),
      );

      let count = 0;
      const errors: string[] = [];
      for (let i = 0; i < grants.length; i++) {
        const grant = grants[i];
        try {
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
      return { count, total: grants.length, errors: errors.slice(0, 5) };
    });

    // Surface new grants to the matcher.
    if (ingested.count > 0) {
      await step.sendEvent("trigger-match-compute", {
        name: "grants/new-opportunities",
        data: { count: ingested.count, source: "firecrawl" },
      });
    }

    return { ok: true, ...ingested };
  }
);
