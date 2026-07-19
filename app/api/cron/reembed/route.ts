import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { embedText } from "@/lib/voyage/embeddings";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch all opportunities with NULL embeddings
  const { data: opps, error } = await supabaseAdmin
    .from("opportunities")
    .select("id,title,description,funder_name")
    .is("embedding", null)
    .eq("status", "active")
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!opps?.length) return NextResponse.json({ updated: 0, message: "All opportunities already have embeddings" });

  let updated = 0;
  const errors: string[] = [];

  for (const opp of opps) {
    try {
      const text = [opp.title, opp.description || opp.title, `Funder: ${opp.funder_name}`].join("\n");
      const embedding = await embedText(text);
      if (embedding.length > 0) {
        await supabaseAdmin.from("opportunities").update({ embedding }).eq("id", opp.id);
        updated++;
      }
      await sleep(400);
    } catch (e) {
      errors.push(`${opp.id}: ${e}`);
    }
  }

  return NextResponse.json({ updated, total: opps.length, errors: errors.slice(0, 5) });
}
