import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { buildOpportunityEmbeddingText, buildOrgEmbeddingText, embedTexts } from "@/lib/embeddings";

// Backfills rows whose embedding is NULL (e.g. ingested while Ollama was
// down). A full re-embed after a model change is scripts/reembed-all.ts.
const BATCH = 64;

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const errors: string[] = [];

  // Opportunities
  const { data: opps, error: oppErr } = await supabaseAdmin
    .from("opportunities")
    .select("id,title,description,funder_name,eligibility_types")
    .is("embedding", null)
    .eq("status", "active")
    .limit(BATCH);
  if (oppErr) return NextResponse.json({ error: oppErr.message }, { status: 500 });

  let oppsUpdated = 0;
  if (opps?.length) {
    const embeddings = await embedTexts(opps.map(buildOpportunityEmbeddingText));
    for (let i = 0; i < opps.length; i++) {
      if (!embeddings[i].length) continue;
      const { error } = await supabaseAdmin.from("opportunities").update({ embedding: embeddings[i] }).eq("id", opps[i].id);
      if (error) errors.push(`opportunity ${opps[i].id}: ${error.message}`);
      else oppsUpdated++;
    }
  }

  // Organizations (only ones with a mission statement — otherwise there's nothing meaningful to embed)
  const { data: orgs, error: orgErr } = await supabaseAdmin
    .from("organizations")
    .select("id,mission_statement,primary_focus_areas,target_beneficiaries,programs,annual_budget_range,geographic_service_area")
    .is("profile_embedding", null)
    .not("mission_statement", "is", null)
    .limit(BATCH);
  if (orgErr) return NextResponse.json({ error: orgErr.message }, { status: 500 });

  let orgsUpdated = 0;
  if (orgs?.length) {
    const embeddings = await embedTexts(orgs.map((o) => buildOrgEmbeddingText(o)));
    for (let i = 0; i < orgs.length; i++) {
      if (!embeddings[i].length) continue;
      const { error } = await supabaseAdmin.from("organizations").update({ profile_embedding: embeddings[i] }).eq("id", orgs[i].id);
      if (error) errors.push(`organization ${orgs[i].id}: ${error.message}`);
      else orgsUpdated++;
    }
  }

  return NextResponse.json({
    opportunities: { updated: oppsUpdated, total: opps?.length ?? 0 },
    organizations: { updated: orgsUpdated, total: orgs?.length ?? 0 },
    errors: errors.slice(0, 5),
  });
}
