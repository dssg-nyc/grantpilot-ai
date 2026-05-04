export interface Opportunity {
  id: string;
  title: string;
  description?: string | null;
  funder_name: string;
  funder_type:
    | "federal_government"
    | "state_government"
    | "local_government"
    | "foundation"
    | "corporate"
    | "international"
    | "individual"
    | "other";
  funding_type: "grant" | "fellowship" | "award" | "in_kind" | "loan" | "prize" | "other";
  amount_min?: number | null;
  amount_max?: number | null;
  deadline?: string | null;
  is_rolling_deadline?: boolean;
  eligibility_types: string[];
  focus_areas: string[];
  geographic_scope?: string;
  geographic_states?: string[];
  source: string;
  source_id?: string | null;
  source_url: string;
  application_url?: string | null;
  status: "active" | "expired" | "closing_soon" | "draft" | "unknown";
  ai_summary?: string | null;
}
