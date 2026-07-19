import Anthropic from "@anthropic-ai/sdk";
import { anthropic } from "@/lib/anthropic/client";
import { DRAFT_ASSISTANCE_PROMPT } from "@/lib/anthropic/prompts/draft-assistance";
import type { Opportunity } from "@/types/opportunity";
import type { OrgProfile } from "@/types/profile";

export interface DraftAssistance {
  mission_alignment: string;
  why_this_funder: string;
  budget_narrative_starter: string;
  key_talking_points: string[];
  suggested_next_steps: string[];
}

/**
 * Type-guard the raw parsed JSON before trusting it. Every field is required
 * and must be the correct type — no partial-credit coercion. If Claude's
 * output is malformed we return null and the caller surfaces an error to the
 * user, rather than silently shipping a fake/empty draft that looks real.
 */
function isValidDraftAssistance(value: unknown): value is DraftAssistance {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.mission_alignment === "string" && v.mission_alignment.trim().length > 0 &&
    typeof v.why_this_funder === "string" && v.why_this_funder.trim().length > 0 &&
    typeof v.budget_narrative_starter === "string" && v.budget_narrative_starter.trim().length > 0 &&
    Array.isArray(v.key_talking_points) && v.key_talking_points.length > 0 &&
    v.key_talking_points.every((p) => typeof p === "string" && p.trim().length > 0) &&
    Array.isArray(v.suggested_next_steps) && v.suggested_next_steps.length > 0 &&
    v.suggested_next_steps.every((p) => typeof p === "string" && p.trim().length > 0)
  );
}

export async function generateDraftAssistance(
  org: OrgProfile,
  opportunity: Opportunity,
  pipelineNotes?: string | null,
): Promise<DraftAssistance | null> {
  let response;
  try {
    response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      messages: [
        { role: "user", content: DRAFT_ASSISTANCE_PROMPT(org, opportunity, pipelineNotes) },
      ],
    });
  } catch (err) {
    // Claude API failure — rate limit (429), overloaded (529), timeout, network
    // error, whatever. None of these are the caller's fault and none of them
    // should crash the route; surface as "no draft" and let the route return a
    // clean error response instead of a 500.
    if (err instanceof Anthropic.APIError) {
      console.error(
        `[draft-generator] Anthropic API error (status ${err.status}): ${err.message}`,
      );
    } else {
      console.error("[draft-generator] Anthropic API call failed:", err);
    }
    return null;
  }

  const raw = response.content[0]?.type === "text" ? response.content[0].text : "";
  // Strip markdown code fences if present
  const text = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();

  try {
    const parsed: unknown = JSON.parse(text);
    if (isValidDraftAssistance(parsed)) return parsed;
  } catch {
    // fall through to extraction attempt below
  }

  // Try extracting JSON from text if Claude added stray commentary around it.
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const extracted: unknown = JSON.parse(jsonMatch[0]);
      if (isValidDraftAssistance(extracted)) return extracted;
    } catch {
      // fall through to null below
    }
  }

  return null;
}
