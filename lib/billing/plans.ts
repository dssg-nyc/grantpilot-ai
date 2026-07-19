export const PLAN_LIMITS = {
  free: { maxVisibleMatches: 15, maxActivePipelineItems: 5, maxAIDraftsPerMonth: 3 },
  pro: { maxVisibleMatches: Infinity, maxActivePipelineItems: Infinity, maxAIDraftsPerMonth: Infinity },
} as const;

export const PRO_PRICE_USD_MONTHLY = 39;

export type Plan = keyof typeof PLAN_LIMITS;

export function getPlanLimits(plan: string | null | undefined) {
  return PLAN_LIMITS[plan === "pro" ? "pro" : "free"];
}

export function isPro(plan: string | null | undefined): boolean {
  return plan === "pro";
}
