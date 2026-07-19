import { NextResponse } from "next/server";
import { embedText } from "@/lib/voyage/embeddings";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { rateLimitGuard, strictRateLimiter } from "@/lib/redis/rate-limiter";

export async function GET(request: Request) {
  const limited = await rateLimitGuard(request, "search", strictRateLimiter);
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "10"), 50);

  if (!q || q.trim().length < 2) {
    return NextResponse.json({ results: [] });
  }

  const supabase = await createSupabaseServerClient();
  const results: Array<{ type: string; id: string; title: string; score: number; highlight?: string }> = [];

  // Full-text search
  const { data: ftsResults } = await supabase
    .from("opportunities")
    .select("id, title, funder_name, ai_summary, status")
    .eq("status", "active")
    .textSearch("title", q, { type: "websearch" })
    .limit(limit);

  for (const row of ftsResults ?? []) {
    results.push({
      type: "opportunity",
      id: row.id,
      title: row.title,
      score: 0.8,
      highlight: row.ai_summary ?? row.funder_name,
    });
  }

  // Semantic search for remaining slots
  if (results.length < limit) {
    const embedding = await embedText(q);
    if (embedding.length > 0) {
      const { data: vectorResults } = await supabase.rpc("match_opportunities", {
        query_embedding: embedding,
        match_threshold: 0.5,
        match_count: limit - results.length,
      });

      const existingIds = new Set(results.map((r) => r.id));
      for (const row of vectorResults ?? []) {
        if (!existingIds.has(row.id)) {
          results.push({
            type: "opportunity",
            id: row.id,
            title: row.title,
            score: row.similarity,
            highlight: row.ai_summary ?? row.funder_name,
          });
        }
      }
    }
  }

  results.sort((a, b) => b.score - a.score);
  return NextResponse.json({ results: results.slice(0, limit) });
}
