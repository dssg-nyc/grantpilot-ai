import { NextResponse } from "next/server";
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
      messages: [{ role: "user", content: `Write exactly 2 plain English sentences summarizing this grant. No markdown, no headers.\n\nTitle: ${title}\nDescription: ${description.substring(0, 600)}\n\nSummary:` }],
    });
    return resp.content[0]?.type === "text" ? resp.content[0].text.trim() : "";
  } catch { return ""; }
}

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: logRow } = await supabaseAdmin
    .from("ingestion_logs")
    .insert({ source: "rss_feeds", source_type: "rss", status: "running" })
    .select("id").single();
  const logId = logRow?.id;

  const items = await fetchAllRssFeeds();
  let ingested = 0;
  const errors: string[] = [];

  for (const item of items) {
    try {
      if (!item.title || item.title.length < 5) continue;
      const { data: existing } = await supabaseAdmin
        .from("opportunities").select("id").eq("source_id", item.source_id).single();
      if (existing) continue;

      const [embedding, aiSummary] = await Promise.all([
        embedText([item.title, item.description, `Funder: ${item.funder_name}`].join("\n")),
        generateAISummary(item.title, item.description),
      ]);

      let deadline: string | null = null;
      if (item.pubDate) {
        const est = new Date(new Date(item.pubDate).getTime() + 60 * 24 * 60 * 60 * 1000);
        if (!isNaN(est.getTime())) deadline = est.toISOString().split("T")[0];
      }

      await supabaseAdmin.from("opportunities").insert({
        title: item.title,
        description: item.description,
        funder_name: item.funder_name,
        funder_type: item.funder_type,
        funding_type: "grant",
        amount_min: null,
        amount_max: null,
        deadline,
        is_rolling_deadline: !deadline,
        eligibility_types: ["nonprofit_501c3", "any"],
        focus_areas: [],
        geographic_scope: "national",
        geographic_states: [],
        source: "rss",
        source_id: item.source_id,
        source_url: item.link,
        application_url: item.link,
        status: "active",
        ai_summary: aiSummary || null,
        embedding: embedding.length > 0 ? embedding : null,
        ai_enriched_at: aiSummary ? new Date().toISOString() : null,
      });
      ingested++;
      await sleep(400);
    } catch (e) {
      errors.push(String(e));
    }
  }

  if (logId) {
    await supabaseAdmin.from("ingestion_logs").update({
      status: "success",
      completed_at: new Date().toISOString(),
      records_fetched: items.length,
      records_new: ingested,
      records_updated: 0,
      records_failed: errors.length,
    }).eq("id", logId);
  }

  return NextResponse.json({ ok: true, ingested, total: items.length, errors: errors.slice(0, 5) });
}
