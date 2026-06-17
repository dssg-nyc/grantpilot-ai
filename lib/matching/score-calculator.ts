import type { Opportunity } from "@/types/opportunity";
import type { OrgProfile } from "@/types/profile";
import { passesGeographicFilter, passesHardEligibility } from "@/lib/matching/eligibility-checker";

export function computeFocusAreaOverlap(orgAreas: string[], oppAreas: string[]): number {
  if (!orgAreas.length || !oppAreas.length) return 0.3;
  const intersection = orgAreas.filter((a) => oppAreas.includes(a));
  const union = new Set([...orgAreas, ...oppAreas]);
  return intersection.length / union.size;
}

export function computeSizeFit(orgBudgetRange: string | undefined, oppMin: number | null | undefined, oppMax: number | null | undefined): number {
  const budgetMidpoints: Record<string, number> = {
    "<50k": 25000,
    "50k_250k": 150000,
    "250k_1m": 625000,
    "1m_5m": 3000000,
    "5m_plus": 10000000,
  };
  const orgBudget = budgetMidpoints[orgBudgetRange ?? "50k_250k"];
  const midpoint = ((oppMin ?? 0) + (oppMax ?? oppMin ?? 0)) / 2;
  if (!midpoint) return 0.5;
  const ratio = midpoint / orgBudget;
  if (ratio >= 0.05 && ratio <= 0.3) return 1;
  if (ratio >= 0.01 && ratio <= 0.5) return 0.7;
  if (ratio >= 0.001 && ratio <= 1) return 0.4;
  return 0.1;
}

export interface ScoreBreakdown {
  /** Composite 0-100. 0 if the org fails a hard eligibility/geo gate. */
  composite: number;
  /** Each dimension is 0-1. */
  semantic: number;
  focus: number;
  eligibility: number;
  geographic: number;
  size: number;
  /** True when both hard gates pass. */
  eligible: boolean;
}

/**
 * Full per-dimension breakdown behind the composite score. Persisted to the
 * matches table and surfaced in the "Why this match?" UI for explainability.
 */
export function computeScoreBreakdown(
  org: OrgProfile,
  opp: Opportunity,
  vectorSimilarity: number,
): ScoreBreakdown {
  const passesEligibility = passesHardEligibility(org, opp);
  const passesGeo = passesGeographicFilter(org, opp);
  const eligible = passesEligibility && passesGeo;

  const semantic = vectorSimilarity;
  const focus = computeFocusAreaOverlap(org.primary_focus_areas, opp.focus_areas);
  const eligibility = passesEligibility ? 1 : 0;
  const geographic = passesGeo ? 1 : 0;
  const size = computeSizeFit(org.annual_budget_range, opp.amount_min, opp.amount_max);

  const composite = eligible
    ? Math.round(
        (semantic * 0.35 + focus * 0.25 + eligibility * 0.2 + geographic * 0.1 + size * 0.1) * 100,
      )
    : 0;

  return { composite, semantic, focus, eligibility, geographic, size, eligible };
}

export function computeCompositeScore(org: OrgProfile, opp: Opportunity, vectorSimilarity: number): number {
  return computeScoreBreakdown(org, opp, vectorSimilarity).composite;
}
