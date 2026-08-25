import type { SupabaseClient } from "@supabase/supabase-js";
import { FOCUS_AREA_TAXONOMY } from "@/lib/utils/taxonomy";
import { SCOUT_FUNDER_TYPES, type ScoutFinding, type ScoutFunderType } from "@/types/scout";

const FUNDER_TYPE_SET = new Set<string>(SCOUT_FUNDER_TYPES);
const FOCUS_AREA_SET = new Set<string>(FOCUS_AREA_TAXONOMY);

function str(input: Record<string, unknown>, key: string, maxLen = 2000): string | null {
  const v = input[key];
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed ? trimmed.slice(0, maxLen) : null;
}

function num(input: Record<string, unknown>, key: string): number | null {
  const v = input[key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  // Models occasionally emit "$50,000" for a number field despite the schema.
  if (typeof v === "string") {
    const parsed = Number(v.replace(/[$,\s]/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function strArray(input: Record<string, unknown>, key: string, allowed?: Set<string>): string[] {
  const v = input[key];
  if (!Array.isArray(v)) return [];
  return v
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim().slice(0, 500))
    .filter((item) => !allowed || allowed.has(item))
    .slice(0, 12);
}

/** Accepts only a real, absolute http(s) URL — anything else is dropped. */
function url(input: Record<string, unknown>, key: string): string | null {
  const raw = str(input, key, 2000);
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function isoDate(input: Record<string, unknown>, key: string): string | null {
  const raw = str(input, key, 40);
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().split("T")[0];
}

export interface RecordFindingResult {
  finding?: ScoutFinding;
  error?: string;
}

/**
 * Validates and persists one `record_funding_opportunity` tool call.
 *
 * Everything here is defensive on purpose: the input is model output shaped by
 * text the model read on arbitrary third-party web pages, so nothing is
 * trusted. Unparseable optional fields are dropped rather than stored, and a
 * missing source_url is a hard rejection — a finding a human cannot click
 * through and verify is exactly the thing this feature exists to avoid.
 */
export async function recordFinding(params: {
  supabase: SupabaseClient;
  runId: string;
  orgId: string;
  input: Record<string, unknown>;
}): Promise<RecordFindingResult> {
  const { supabase, runId, orgId, input } = params;

  const title = str(input, "title", 500);
  const funderName = str(input, "funder_name", 300);
  const sourceUrl = url(input, "source_url");

  if (!title) return { error: "title is required." };
  if (!funderName) return { error: "funder_name is required." };
  if (!sourceUrl) {
    return {
      error:
        "source_url is required and must be a full http(s) URL to the funder's own page for this opportunity. Fetch the real page and call again with its URL.",
    };
  }

  const rawFunderType = str(input, "funder_type", 40);
  const funderType: ScoutFunderType =
    rawFunderType && FUNDER_TYPE_SET.has(rawFunderType) ? (rawFunderType as ScoutFunderType) : "other";

  const rawConfidence = str(input, "evidence_confidence", 10);
  const evidenceConfidence =
    rawConfidence === "high" || rawConfidence === "low" || rawConfidence === "medium" ? rawConfidence : "medium";

  const rawScore = num(input, "fit_score") ?? 0;
  const fitScore = Math.max(0, Math.min(100, Math.round(rawScore)));

  const row = {
    run_id: runId,
    org_id: orgId,
    title,
    funder_name: funderName,
    funder_type: funderType,
    source_url: sourceUrl,
    application_url: url(input, "application_url"),
    program_summary: str(input, "program_summary", 4000),
    amount_min: num(input, "amount_min"),
    amount_max: num(input, "amount_max"),
    amount_note: str(input, "amount_note", 500),
    deadline: isoDate(input, "deadline"),
    deadline_note: str(input, "deadline_note", 500),
    eligibility_summary: str(input, "eligibility_summary", 2000),
    geographic_eligibility: str(input, "geographic_eligibility", 500),
    focus_areas: strArray(input, "focus_areas", FOCUS_AREA_SET),
    fit_score: fitScore,
    fit_rationale: str(input, "fit_rationale", 2000) ?? "",
    concerns: strArray(input, "concerns"),
    evidence_confidence: evidenceConfidence,
    already_in_database: input.already_in_database === true,
  };

  const { data, error } = await supabase.from("scout_findings").insert(row).select().single();
  if (error) return { error: error.message };

  return { finding: data as ScoutFinding };
}
