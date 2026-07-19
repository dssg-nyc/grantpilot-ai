export const GRANT_SECTION_KEYS = [
  "executive_summary",
  "statement_of_need",
  "project_description",
  "organizational_capacity",
  "budget_narrative",
  "evaluation_plan",
] as const;

export type GrantSectionKey = (typeof GRANT_SECTION_KEYS)[number];

export const GRANT_SECTIONS: Record<GrantSectionKey, { label: string; guidance: string }> = {
  executive_summary: {
    label: "Executive Summary",
    guidance:
      "A concise (1 paragraph) overview of who the organization is, what it's requesting funding for, and the expected impact. Written last in practice, but shown first.",
  },
  statement_of_need: {
    label: "Statement of Need",
    guidance:
      "The problem or gap this project addresses, grounded in the org's actual target beneficiaries and geographic service area. Explains why this matters now.",
  },
  project_description: {
    label: "Project Description & Goals",
    guidance:
      "What will actually be done with the funding: activities, timeline, and specific goals/objectives, grounded in the org's real programs.",
  },
  organizational_capacity: {
    label: "Organizational Capacity",
    guidance:
      "Why this org is positioned to deliver: years in operation, relevant programs, staff capacity, past funding history where known.",
  },
  budget_narrative: {
    label: "Budget Narrative",
    guidance:
      "A narrative justification connecting the requested amount to the project's activities, framed against the opportunity's stated funding range and the org's annual budget.",
  },
  evaluation_plan: {
    label: "Evaluation Plan",
    guidance:
      "How success will be measured — output/outcome measures appropriate to the project, framed honestly given what data the org has said it can track.",
  },
};
