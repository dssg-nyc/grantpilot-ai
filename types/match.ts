export interface Match {
  id: string;
  org_id: string;
  opportunity_id: string;
  raw_similarity_score: number;
  match_score: number;
  success_probability: number;
  match_reasons: string[];
  disqualifiers: string[];
  recommended_action?: string | null;
  status: "new" | "viewed" | "saved" | "applied" | "archived" | "dismissed";
}
