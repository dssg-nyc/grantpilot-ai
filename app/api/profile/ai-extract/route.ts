import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { PROFILE_EXTRACTION_PROMPT } from "@/lib/anthropic/prompts/profile-extraction";
import { rateLimitGuard, strictRateLimiter } from "@/lib/redis/rate-limiter";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: Request) {
  // This endpoint calls Claude on unauthenticated input — rate limit hard.
  const limited = await rateLimitGuard(request, "ai-extract", strictRateLimiter);
  if (limited) return limited;

  const body = await request.json();
  const { mission_statement } = body;

  if (!mission_statement || mission_statement.trim().length < 20) {
    return NextResponse.json(
      { error: "Mission statement must be at least 20 characters" },
      { status: 400 },
    );
  }

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: PROFILE_EXTRACTION_PROMPT(mission_statement.trim()),
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";

  let extracted: {
    primary_focus_areas?: string[];
    target_beneficiaries?: string[];
    geographic_indicators?: string[];
    org_type_indicator?: string;
    sdg_alignments?: number[];
    confidence_score?: number;
  };

  try {
    // Strip markdown code fences if present
    const cleaned = text.replace(/```(?:json)?\s*/g, "").replace(/```\s*$/g, "").trim();
    extracted = JSON.parse(cleaned);
  } catch {
    return NextResponse.json({ error: "AI extraction failed to parse" }, { status: 500 });
  }

  const geoIndicators = extracted.geographic_indicators ?? [];
  const statePattern = /^[A-Z]{2}$/;
  const service_states = geoIndicators.filter((g) => statePattern.test(g));
  const geographic_service_area =
    service_states.length === 0
      ? "national"
      : service_states.length === 1
        ? "state"
        : "multi_state";

  return NextResponse.json({
    suggestions: {
      primary_focus_areas: extracted.primary_focus_areas ?? [],
      target_beneficiaries: extracted.target_beneficiaries ?? [],
      geographic_service_area,
      service_states,
      sdg_alignments: extracted.sdg_alignments ?? [],
      org_type: extracted.org_type_indicator ?? "ngo",
    },
    confidence: extracted.confidence_score ?? 0.7,
  });
}
