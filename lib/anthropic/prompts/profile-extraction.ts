import { FOCUS_AREA_TAXONOMY } from "@/lib/utils/taxonomy";

export const PROFILE_EXTRACTION_PROMPT = (missionStatement: string) =>
  `You are an expert in US nonprofit sector taxonomy and funding classification.

Extract structured information from this nonprofit's mission statement/description.
Respond in valid JSON only, no preamble.

MISSION STATEMENT:
"${missionStatement}"

RESPOND ONLY WITH:
{
  "primary_focus_areas": <array of 1-3 focus areas from this exact list: ${JSON.stringify(FOCUS_AREA_TAXONOMY)}>,
  "target_beneficiaries": <array of 1-4 specific beneficiary groups mentioned or implied>,
  "geographic_indicators": <array of states, cities, or regions mentioned — use 2-letter state codes for states>,
  "org_type_indicator": <"ngo" | "community_group" | "educational" | "individual" | "impact_startup" | "other">,
  "sdg_alignments": <array of UN SDG numbers (1-17) that align with this mission>,
  "confidence_score": <float 0-1, how confident you are in these extractions>
}`;
