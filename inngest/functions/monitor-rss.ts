import { inngest } from "@/inngest/client";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { embedText } from "@/lib/voyage/embeddings";
import { fetchAllRssFeeds } from "@/lib/data-sources/rss-monitor";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function generateAISummary(title: string, description: string): Promise<string> {
  try {
    const resp = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 150,
      messages: [{ role: "user", content: `Write exactly 2 plain English sentences summarizing this grant opportunity. No markdown, no headers, no bullet points.\n\nTitle: ${title}\nDescription: ${description.substring(0, 600)}\n\nSummary:` }],
    });
    return resp.content[0]?.type === "text" ? resp.content[0].text.trim() : "";
  } catch { return ""; }
}

export const monitorRss = inngest.createFunction(
  { id: "monitor-rss", name: "Monitor RSS Feeds", concurrency: { limit: 1 }, triggers: [{ cron: "0 */4 * * *" }] },
  async ({ step }) => {
    const items = await step.run("fetch-rss", async () => {
      return fetchAllRssFeeds();
    });

    if (!items.length) return { ok: true, ingested: 0 };

    let newCount = 0;
    let updatedCount = 0;
    const errors: string[] = [];

    for (const item of items) {
      try {
        if (!item.title || item.title.length < 5) continue;

        // Look up by (source, source_id) — same composite key convention as
        // every other ingestion function — instead of skipping re-syncs.
        const { data: existing } = await supabaseAdmin
          .from("opportunities")
          .select("id")
          .eq("source_id", item.source_id)
          .eq("source", "rss")
          .maybeSingle();

        const [embedding, aiSummary] = await Promise.all([
          embedText([item.title, item.description, `Funder: ${item.funder_name}`].join("\n")),
          generateAISummary(item.title, item.description),
        ]);

        let deadline: string | null = null;
        if (item.pubDate) {
          const d = new Date(item.pubDate);
          // RSS pub dates are publish dates, not deadlines — set to 60 days from now as estimate
          const est = new Date(d.getTime() + 60 * 24 * 60 * 60 * 1000);
          if (!isNaN(est.getTime())) deadline = est.toISOString().split("T")[0];
        }

        // RSS never gives us a real deadline (only an estimate derived from
        // pubDate), but we can still recompute expiry once that estimate has
        // passed — mirrors sync-grants-gov.ts's expiry check.
        const status = deadline && new Date(deadline) < new Date() ? "expired" : "active";

        // Fields the feed re-provides fresh on every poll — safe to overwrite.
        const freshFields = {
          title: item.title,
          description: item.description,
          funder_name: item.funder_name,
          funder_type: item.funder_type,
          funding_type: "grant",
          amount_min: null,
          amount_max: null,
          deadline,
          is_rolling_deadline: !deadline,
          geographic_scope: "national",
          geographic_states: [],
          source_url: item.link,
          application_url: item.link,
          status,
          ai_summary: aiSummary || null,
          embedding: embedding.length > 0 ? embedding : null,
          ai_enriched_at: aiSummary ? new Date().toISOString() : null,
        };

        if (existing) {
          // Don't touch focus_areas/eligibility_types on update — the RSS
          // feeds never provide real values for these (hardcoded placeholders
          // at insert time), so leave whatever's there rather than resetting it.
          await supabaseAdmin
            .from("opportunities")
            .update({ ...freshFields, updated_at: new Date().toISOString() })
            .eq("id", existing.id);
          updatedCount++;
        } else {
          await supabaseAdmin.from("opportunities").insert({
            ...freshFields,
            eligibility_types: ["nonprofit_501c3", "any"],
            focus_areas: [],
            source: "rss",
            source_id: item.source_id,
          });
          newCount++;
        }

        await sleep(400);
      } catch (e) {
        errors.push(`${item.source_id}: ${e}`);
      }
    }

    return {
      ok: true,
      ingested: newCount,
      updated: updatedCount,
      total: items.length,
      errors: errors.slice(0, 5),
    };
  }
);
