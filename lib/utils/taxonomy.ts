export const FOCUS_AREA_TAXONOMY = [
  "Education",
  "Health & Wellness",
  "Environment & Climate",
  "Technology & Digital Equity",
  "Arts & Culture",
  "Economic Development",
  "Housing & Homelessness",
  "Food Security",
  "Human Rights & Justice",
  "Youth Development",
  "Women & Gender Equity",
  "Disability Rights",
  "Veterans & Military",
  "Immigration & Refugees",
  "Animal Welfare",
  "Research & Academia",
  "Capacity Building",
  "Disaster Relief",
  "Community Development",
  "LGBTQ+ Rights",
] as const;

export type FocusArea = (typeof FOCUS_AREA_TAXONOMY)[number];
