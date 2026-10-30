import { createClient } from "@supabase/supabase-js";
import type { Opportunity } from "@/types/opportunity";
import { calibrateSimilarity, rawSimilarityThreshold } from "@/lib/embeddings";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export interface VectorSearchResult {
  opportunity: Opportunity;
  similarity: number;
}

export async function vectorSimilaritySearch(
  embedding: number[],
  limit = 100,
): Promise<VectorSearchResult[]> {
  if (!embedding || embedding.length === 0) return [];

  // pgvector cosine distance: <=> returns distance (0=identical, 2=opposite)
  // We convert to similarity: 1 - (distance/2) gives 0–1 range
  const { data, error } = await supabaseAdmin.rpc("match_opportunities", {
    query_embedding: embedding,
    match_threshold: rawSimilarityThreshold(0.3),
    match_count: limit,
  });

  if (error) {
    console.error("Vector search error:", error);
    return [];
  }

  return (data ?? []).map(
    (row: { similarity: number } & Record<string, unknown>) => ({
      opportunity: row as unknown as Opportunity,
      similarity: calibrateSimilarity(row.similarity as number),
    }),
  );
}
