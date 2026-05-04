import type { Opportunity } from "@/types/opportunity";

export function normalizeOpportunity(input: Partial<Opportunity>): Opportunity {
  return {
    id: input.id ?? crypto.randomUUID(),
    title: input.title ?? "Untitled opportunity",
    description: input.description ?? null,
    funder_name: input.funder_name ?? "Unknown funder",
    funder_type: input.funder_type ?? "other",
    funding_type: input.funding_type ?? "grant",
    amount_min: input.amount_min ?? null,
    amount_max: input.amount_max ?? null,
    deadline: input.deadline ?? null,
    is_rolling_deadline: input.is_rolling_deadline ?? false,
    eligibility_types: input.eligibility_types ?? [],
    focus_areas: input.focus_areas ?? [],
    geographic_scope: input.geographic_scope ?? "national",
    geographic_states: input.geographic_states ?? [],
    source: input.source ?? "manual",
    source_id: input.source_id ?? null,
    source_url: input.source_url ?? "",
    application_url: input.application_url ?? null,
    status: input.status ?? "unknown",
    ai_summary: input.ai_summary ?? null,
  };
}
