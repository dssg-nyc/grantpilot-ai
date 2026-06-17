import type { Opportunity } from "@/types/opportunity";
import type { OrgProfile } from "@/types/profile";

export const MATCH_ANALYSIS_PROMPT = (org: OrgProfile, opportunity: Opportunity) => `You are a senior grant strategist analyzing the fit between ONE nonprofit and ONE funding opportunity. Respond with ONLY a raw JSON object — no markdown, no code fences, no commentary.

ORGANIZATION
Name: ${org.legal_name}
Mission: ${org.mission_statement ?? "N/A"}
Focus areas: ${(org.primary_focus_areas ?? []).join(", ") || "General nonprofit"}
Annual budget: ${org.annual_budget_range ?? "Unknown"}
501(c)(3): ${org.is_501c3 ? "Yes" : "No / pending"}
Service area: ${org.geographic_service_area ?? "national"}${org.service_states?.length ? ` (${org.service_states.join(", ")})` : ""}
Years in operation: ${org.years_in_operation ?? "Unknown"}
Has received grants before: ${org.has_received_grants ? "Yes" : "No / unknown"}

OPPORTUNITY
Title: ${opportunity.title}
Funder: ${opportunity.funder_name ?? "Unknown"} (${opportunity.funder_type ?? "unknown type"})
Amount: ${opportunity.amount_min != null || opportunity.amount_max != null ? `$${opportunity.amount_min ?? "?"} - $${opportunity.amount_max ?? "?"}` : "Not stated"}
Deadline: ${opportunity.deadline ?? "Rolling / unknown"}
Focus areas: ${(opportunity.focus_areas ?? []).join(", ") || "Unspecified"}
Eligibility: ${(opportunity.eligibility_types ?? []).join(", ") || "Unspecified"}
Geography: ${opportunity.geographic_scope ?? "national"}${opportunity.geographic_states?.length ? ` (${opportunity.geographic_states.join(", ")})` : ""}
Description: ${(opportunity.description ?? "").slice(0, 1500)}

Return EXACTLY this JSON shape:
{"match_score":75,"success_probability":55,"match_reasons":["Specific reason 1","Specific reason 2"],"disqualifiers":[],"recommended_action":"One concrete next step","analysis_confidence":"high"}

SCORING RULES — match_score and success_probability are DIFFERENT axes. Do NOT copy one into the other:
- match_score (0-100): how well the org's mission, focus, budget size, and geography FIT what this funder is looking for. Pure thematic/relevance fit.
- success_probability (0-100): the realistic likelihood THIS org would WIN the award if it applied — factoring eligibility compliance, competition level, the org's track record and maturity (years in operation, prior grants), and budget fit. This is almost always LOWER than match_score. A strong thematic fit that is a new/tiny org competing in a large national program, or that has weak eligibility, should have success_probability well below match_score. Only when eligibility is airtight, the org is established, and competition is modest should the two be close.
- match_reasons: 2-4 SPECIFIC reasons that reference this org and this opportunity (never generic boilerplate).
- disqualifiers: 0-3 hard blockers or serious concerns (e.g., "Requires 501(c)(3); org is pending"). Use [] if none.
- analysis_confidence: "high" if you had enough detail to judge confidently, "medium"/"low" if key fields were missing.

Return ONLY the JSON object.`;
