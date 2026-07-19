export interface PipelineItem {
  id: string;
  org_id: string;
  opportunity_id?: string | null;
  title: string;
  stage:
    | "saved"
    | "researching"
    | "drafting"
    | "submitted"
    | "awarded"
    | "rejected"
    | "withdrawn";
  notes?: string | null;
  deadline?: string | null;
  opportunity?: { title: string; funder_name: string } | null;
}
