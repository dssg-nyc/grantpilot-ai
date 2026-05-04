import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { embedText } from "@/lib/voyage/embeddings";
import { scrapeAllFoundations } from "@/lib/firecrawl/scrapers/foundation-scraper";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: logRow } = await supabaseAdmin
    .from("ingestion_logs")
    .insert({ source: "firecrawl_foundations", source_type: "foundation", status: "running" })
    .select("id").single();
  const logId = logRow?.id;

  const grants = await scrapeAllFoundations();
  let ingested = 0;
  const errors: string[] = [];

  for (const grant of grants) {
    try {
      const sourceId = `firecrawl_${Buffer.from(grant.title + grant.funder_name).toString("base64").slice(0, 32)}`;
      const { data: existing } = await supabaseAdmin
        .from("opportunities").select("id").eq("source_id", sourceId).single();
      if (existing) continue;

      const embedding = await embedText([grant.title, grant.description, `Funder: ${grant.funder_name}`].join("\n"));
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
      errors.push(String(e));
    }
  }

  if (logId) {
    await supabaseAdmin.from("ingestion_logs").update({
      status: errors.length > ingested ? "failed" : "success",
      completed_at: new Date().toISOString(),
      records_fetched: grants.length,
      records_new: ingested,
      records_updated: 0,
      records_failed: errors.length,
    }).eq("id", logId);
  }

  return NextResponse.json({ ok: true, ingested, total: grants.length, errors: errors.slice(0, 5) });
}
