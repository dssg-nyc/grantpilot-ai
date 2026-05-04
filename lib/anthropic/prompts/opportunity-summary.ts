export const OPPORTUNITY_SUMMARY_PROMPT = (rawText: string) =>
  `Extract a structured grant record from this text. Return strict JSON only.\n${rawText.slice(0, 3000)}`;
