export type OrgType =
  | "ngo"
  | "community_group"
  | "educational"
  | "individual"
  | "impact_startup"
  | "other";

export interface Program {
  name: string;
  description: string;
  budget?: number;
}

export interface OrgProfile {
  id?: string;
  legal_name: string;
  dba_name?: string | null;
  ein?: string | null;
  is_501c3?: boolean | null;
  year_founded?: number | null;
  website_url?: string | null;
  org_type: OrgType;
  mission_statement?: string | null;
  primary_focus_areas: string[];
  secondary_focus_areas: string[];
  target_beneficiaries: string[];
  geographic_service_area: "national" | "multi_state" | "state" | "regional" | "local";
  service_states: string[];
  service_cities: string[];
  sdg_alignments: number[];
  annual_budget_range?: "<50k" | "50k_250k" | "250k_1m" | "1m_5m" | "5m_plus";
  years_in_operation?: number;
  programs: Program[];
  // DB-computed fields
  profile_embedding?: number[] | null;
  profile_completeness?: number;
  staff_full_time?: number;
  staff_part_time?: number;
  has_received_grants?: boolean;
  avg_grant_size_range?: string | null;
  previous_funder_types?: string[];
  has_active_grants?: boolean;
  min_grant_size?: number;
  max_grant_size?: number;
  preferred_grant_types?: string[];
  notification_frequency?: "daily" | "weekly" | "never";
  match_score_threshold?: number;
  logo_url?: string | null;
  created_at?: string;
  updated_at?: string;
}
