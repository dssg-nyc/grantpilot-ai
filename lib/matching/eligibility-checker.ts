import type { Opportunity } from "@/types/opportunity";
import type { OrgProfile } from "@/types/profile";

export function passesHardEligibility(org: OrgProfile, opp: Opportunity): boolean {
  if (opp.eligibility_types.includes("nonprofit_501c3") && !org.is_501c3) return false;
  return true;
}

export function passesGeographicFilter(org: OrgProfile, opp: Opportunity): boolean {
  if (opp.geographic_scope === "national") return true;
  if (!opp.geographic_states?.length) return true;
  return org.service_states.some((state) => opp.geographic_states?.includes(state));
}
