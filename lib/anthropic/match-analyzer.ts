import { anthropic } from "@/lib/anthropic/client";
import { MATCH_ANALYSIS_PROMPT } from "@/lib/anthropic/prompts/match-analysis";
import type { Opportunity } from "@/types/opportunity";
import type { OrgProfile } from "@/types/profile";

export interface MatchAnalysis {
  match_score: number | null;
  success_probability: number | null;
  match_reasons: string[];
  disqualifiers: string[];
  recommended_action: string;
  analysis_confidence: "high" | "medium" | "low";
}

const fallback: MatchAnalysis = {
  match_score: null,
  success_probability: null,
  match_reasons: [],
  disqualifiers: ["AI analysis unavailable — showing composite-based score"],
  recommended_action: "Review eligibility manually",
  analysis_confidence: "low",
};

export async function analyzeMatch(org: OrgProfile, opportunity: Opportunity): Promise<MatchAnalysis> {
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    messages: [{ role: "user", content: MATCH_ANALYSIS_PROMPT(org, opportunity) }],
  });

  const raw = response.content[0]?.type === "text" ? response.content[0].text : "{}";
  // Strip markdown code blocks if present
  const text = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  try {
    const parsed = JSON.parse(text) as MatchAnalysis;
    if (typeof parsed.match_score !== "number") return fallback;
    return normalizeAnalysis(parsed);
  } catch {
    // Try extracting JSON from text if Claude added commentary
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const extracted = JSON.parse(jsonMatch[0]) as MatchAnalysis;
        if (typeof extracted.match_score === "number") return normalizeAnalysis(extracted);
      } catch { /* fall through */ }
    }
    return fallback;
  }
}

const clamp = (n: unknown, fallbackVal = 0): number => {
  const v = typeof n === "number" && Number.isFinite(n) ? n : fallbackVal;
  return Math.max(0, Math.min(100, Math.round(v)));
};

/**
 * Sanitize raw LLM output: clamp scores to 0-100, coerce arrays, and enforce
 * the invariant that success_probability never exceeds match_score (you cannot
 * be more likely to win than you are a fit).
 */
function normalizeAnalysis(a: MatchAnalysis): MatchAnalysis {
  const match_score = clamp(a.match_score);
  const success_probability = Math.min(match_score, clamp(a.success_probability));
  const confidence = a.analysis_confidence;
  return {
    match_score,
    success_probability,
    match_reasons: Array.isArray(a.match_reasons) ? a.match_reasons.filter((r) => typeof r === "string" && r.trim()).slice(0, 4) : [],
    disqualifiers: Array.isArray(a.disqualifiers) ? a.disqualifiers.filter((d) => typeof d === "string" && d.trim()).slice(0, 3) : [],
    recommended_action: typeof a.recommended_action === "string" ? a.recommended_action : "",
    analysis_confidence: confidence === "high" || confidence === "medium" || confidence === "low" ? confidence : "medium",
  };
}

export async function batchAnalyzeMatches(
  org: OrgProfile,
  opportunities: Opportunity[],
  concurrency = 5,
): Promise<Map<string, MatchAnalysis>> {
  const results = new Map<string, MatchAnalysis>();
  for (let i = 0; i < opportunities.length; i += concurrency) {
    const chunk = opportunities.slice(i, i + concurrency);
    const analyzed = await Promise.allSettled(
      chunk.map(async (opp) => ({ id: opp.id, analysis: await analyzeMatch(org, opp) })),
    );
    analyzed.forEach((item) => {
      if (item.status === "fulfilled") results.set(item.value.id, item.value.analysis);
    });
  }
  return results;
}
