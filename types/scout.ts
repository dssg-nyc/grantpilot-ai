export type ScoutScope = "organization" | "project";
export type ScoutRunStatus = "running" | "completed" | "failed";
export type EvidenceConfidence = "high" | "medium" | "low";

export type ScoutFunderType =
  | "federal_government"
  | "state_government"
  | "local_government"
  | "foundation"
  | "corporate"
  | "international"
  | "other";

export const SCOUT_FUNDER_TYPES: ScoutFunderType[] = [
  "federal_government",
  "state_government",
  "local_government",
  "foundation",
  "corporate",
  "international",
  "other",
];

export const SCOUT_FUNDER_TYPE_LABELS: Record<ScoutFunderType, string> = {
  federal_government: "Federal",
  state_government: "State",
  local_government: "Local / City",
  foundation: "Foundation",
  corporate: "Corporate",
  international: "International",
  other: "Other",
};

/** What the user asks the scout to go and find. */
export interface ScoutRequest {
  scope: ScoutScope;
  project_name?: string;
  project_description?: string;
  funding_need_min?: number | null;
  funding_need_max?: number | null;
  geographic_focus?: string;
  funder_types?: ScoutFunderType[];
  target_count?: number;
}

/** One funding opportunity the agent found and verified on the open web. */
export interface ScoutFinding {
  id: string;
  run_id: string;
  title: string;
  funder_name: string;
  funder_type: ScoutFunderType;
  source_url: string;
  application_url: string | null;
  program_summary: string | null;
  amount_min: number | null;
  amount_max: number | null;
  amount_note: string | null;
  deadline: string | null;
  deadline_note: string | null;
  eligibility_summary: string | null;
  geographic_eligibility: string | null;
  focus_areas: string[];
  fit_score: number;
  fit_rationale: string;
  concerns: string[];
  evidence_confidence: EvidenceConfidence;
  already_in_database: boolean;
  imported_opportunity_id: string | null;
  imported_pipeline_item_id: string | null;
  created_at: string;
}

export interface ScoutRun {
  id: string;
  scope: ScoutScope;
  project_name: string | null;
  project_description: string | null;
  funding_need_min: number | null;
  funding_need_max: number | null;
  geographic_focus: string | null;
  funder_types: string[];
  target_count: number;
  status: ScoutRunStatus;
  summary: string | null;
  error: string | null;
  finding_count: number;
  searches_used: number;
  started_at: string;
  completed_at: string | null;
}

export interface ScoutRunWithFindings extends ScoutRun {
  findings: ScoutFinding[];
}
