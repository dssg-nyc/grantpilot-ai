import type { Opportunity } from "@/types/opportunity";
import type { OrgProfile } from "@/types/profile";

export const MATCH_ANALYSIS_PROMPT = (org: OrgProfile, opportunity: Opportunity) => `You are a grant matching expert. Respond with ONLY a raw JSON object — no markdown, no code blocks, no commentary.

Organization: ${org.legal_name}
Mission: ${org.mission_statement ?? "N/A"}
Focus areas: ${(org.primary_focus_areas ?? []).join(", ") || "General nonprofit"}
Opportunity: ${opportunity.title}
Funder: ${opportunity.funder_name ?? "Unknown"}
Description: ${(opportunity.description ?? "").slice(0, 1200)}

Return this exact JSON structure:
{"match_score":75,"success_probability":60,"match_reasons":["Reason 1","Reason 2"],"disqualifiers":["If any"],"recommended_action":"Apply immediately","analysis_confidence":"high"}

Use match_score 0-100, success_probability 0-100. Return ONLY the JSON object.`;
