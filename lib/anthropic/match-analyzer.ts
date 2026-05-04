import { anthropic } from "@/lib/anthropic/client";
import { MATCH_ANALYSIS_PROMPT } from "@/lib/anthropic/prompts/match-analysis";
import type { Opportunity } from "@/types/opportunity";
import type { OrgProfile } from "@/types/profile";

export interface MatchAnalysis {
  match_score: number;
  success_probability: number;
  match_reasons: string[];
  disqualifiers: string[];
  recommended_action: string;
  analysis_confidence: "high" | "medium" | "low";
}

const fallback: MatchAnalysis = {
  match_score: 0,
  success_probability: 0,
  match_reasons: [],
  disqualifiers: ["Analysis unavailable"],
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
    // Validate that we got real scores, not zeros from a malformed response
    if (typeof parsed.match_score !== "number") return fallback;
    return parsed;
  } catch {
    // Try extracting JSON from text if Claude added commentary
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try { return JSON.parse(jsonMatch[0]) as MatchAnalysis; } catch { /* fall through */ }
    }
    return fallback;
  }
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
