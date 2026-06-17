import { vectorSimilaritySearch } from "@/lib/matching/vector-search";
import { computeScoreBreakdown } from "@/lib/matching/score-calculator";
import { batchAnalyzeMatches } from "@/lib/anthropic/match-analyzer";
import type { OrgProfile } from "@/types/profile";
import type { Opportunity } from "@/types/opportunity";

export interface MatchRow {
  org_id: string;
  opportunity_id: string;
  raw_similarity_score: number;
  match_score: number;
  focus_area_score: number;
  eligibility_score: number;
  geographic_score: number;
  size_fit_score: number;
  success_probability: number;
  match_reasons: string[];
  disqualifiers: string[];
  recommended_action: string | null;
  analysis_confidence: string | null;
  ai_analysis_at: string | null;
  status: string;
}

/**
 * Single source of truth for scoring one org against the opportunity pool:
 * vector search -> per-dimension composite breakdown -> filter -> deep AI
 * analysis on the top N -> rows ready to upsert into `matches`.
 *
 * Used by the Inngest compute/recompute jobs and the manual compute API so
 * per-dimension scores, analysis confidence, and the success-probability
 * fallback behave identically everywhere.
 */
export async function computeMatchRowsForOrg(
  org: OrgProfile & { id: string },
  opts: { topK?: number; analyzeTop?: number; minComposite?: number } = {},
): Promise<MatchRow[]> {
  const { topK = 100, analyzeTop = 20, minComposite = 25 } = opts;
  const embedding = org.profile_embedding as unknown as number[] | null;
  if (!embedding) return [];

  const topOpps = await vectorSimilaritySearch(embedding, topK);

  const scored = topOpps
    .map(({ opportunity, similarity }) => {
      const opp = opportunity as unknown as Opportunity;
      return { opportunity: opp, similarity, breakdown: computeScoreBreakdown(org, opp, similarity) };
    })
    .filter((o) => o.breakdown.composite >= minComposite)
    .sort((a, b) => b.breakdown.composite - a.breakdown.composite);

  if (scored.length === 0) return [];

  const top = scored.slice(0, analyzeTop);
  const analyses = await batchAnalyzeMatches(org, top.map((o) => o.opportunity));

  const now = new Date().toISOString();
  return top.map(({ opportunity, similarity, breakdown }) => {
    const analysis = analyses.get(opportunity.id);
    // When AI analysis is unavailable, fall back to the composite score and a
    // conservative success estimate derived from it — never a misleading 0.
    const matchScore = analysis?.match_score ?? breakdown.composite;
    const successProb = analysis?.success_probability ?? Math.round(breakdown.composite * 0.7);
    return {
      org_id: org.id,
      opportunity_id: opportunity.id,
      raw_similarity_score: similarity,
      match_score: matchScore,
      focus_area_score: breakdown.focus,
      eligibility_score: breakdown.eligibility,
      geographic_score: breakdown.geographic,
      size_fit_score: breakdown.size,
      success_probability: Math.min(matchScore, successProb),
      match_reasons: analysis?.match_reasons ?? [],
      disqualifiers: analysis?.disqualifiers ?? [],
      recommended_action: analysis?.recommended_action ?? null,
      analysis_confidence: analysis?.analysis_confidence ?? null,
      ai_analysis_at: analysis ? now : null,
      status: "new",
    };
  });
}
