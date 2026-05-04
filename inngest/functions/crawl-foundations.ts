import { inngest } from "@/inngest/client";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { embedText } from "@/lib/voyage/embeddings";
import { scrapeAllFoundations } from "@/lib/firecrawl/scrapers/foundation-scraper";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const crawlFoundations = inngest.createFunction(
  { id: "crawl-foundations", name: "Crawl Foundation & Corporate Grants", concurrency: { limit: 1 }, triggers: [{ cron: "0 6 * * *" }] },
  async ({ step }) => {
    const grants = await step.run("scrape-foundations", async () => {
      return scrapeAllFoundations();
    });

    if (!grants.length) return { ok: true, ingested: 0 };

    let ingested = 0;
    const errors: string[] = [];

    for (const grant of grants) {
      try {
        const sourceId = `firecrawl_${Buffer.from(grant.title + grant.funder_name).toString("base64").slice(0, 32)}`;

        const { data: existing } = await supabaseAdmin
          .from("opportunities")
          .select("id")
          .eq("source_id", sourceId)
          .single();

        if (existing) continue; // Skip already ingested

        const embeddingText = [grant.title, grant.description, `Funder: ${grant.funder_name}`].join("\n");
        const embedding = await embedText(embeddingText);

        let deadline: string | null = null;
        if (grant.deadline) {
          const d = new Date(grant.deadline);
          if (!isNaN(d.getTime())) deadline = d.toISOString().split("T")[0];
        }

        await supabaseAdmin.from("opportunities").insert({
          title: grant.title,
          description: grant.description,
          funder_name: grant.funder_name,
          funder_type: grant.funder_type,
          funding_type: "grant",
          amount_min: grant.amount_min,
          amount_max: grant.amount_max,
          deadline,
          is_rolling_deadline: !deadline,
          eligibility_types: grant.eligibility_types.length ? grant.eligibility_types : ["nonprofit_501c3"],
          focus_areas: grant.focus_areas,
          geographic_scope: "national",
          geographic_states: [],
          source: "firecrawl",
          source_id: sourceId,
          source_url: grant.source_url,
          application_url: grant.application_url,
          status: deadline && new Date(deadline) < new Date() ? "expired" : "active",
          embedding: embedding.length > 0 ? embedding : null,
          ai_enriched_at: new Date().toISOString(),
        });

        ingested++;
        await sleep(400);
      } catch (e) {
        errors.push(`${grant.title}: ${e}`);
      }
    }

    return { ok: true, ingested, total: grants.length, errors: errors.slice(0, 5) };
  }
);
