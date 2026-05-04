import { useQuery } from "@tanstack/react-query";

interface OpportunityFilters {
  page?: number;
  limit?: number;
  status?: string;
  funder_type?: string;
  funding_type?: string;
  focus_areas?: string[];
  amount_min?: number;
  amount_max?: number;
  deadline_from?: string;
  deadline_to?: string;
  geographic_scope?: string;
  states?: string[];
  sort?: string;
  search?: string;
}

export function useOpportunities(filters: OpportunityFilters = {}) {
  const params = new URLSearchParams();
  if (filters.page) params.set("page", String(filters.page));
  if (filters.limit) params.set("limit", String(filters.limit));
  if (filters.status) params.set("status", filters.status);
  if (filters.funder_type) params.set("funder_type", filters.funder_type);
  if (filters.funding_type) params.set("funding_type", filters.funding_type);
  if (filters.focus_areas?.length) params.set("focus_areas", filters.focus_areas.join(","));
  if (filters.amount_min != null) params.set("amount_min", String(filters.amount_min));
  if (filters.amount_max != null) params.set("amount_max", String(filters.amount_max));
  if (filters.deadline_from) params.set("deadline_from", filters.deadline_from);
  if (filters.deadline_to) params.set("deadline_to", filters.deadline_to);
  if (filters.geographic_scope) params.set("geographic_scope", filters.geographic_scope);
  if (filters.states?.length) params.set("states", filters.states.join(","));
  if (filters.sort) params.set("sort", filters.sort);
  if (filters.search) params.set("search", filters.search);

  const queryString = params.toString();

  return useQuery({
    queryKey: ["opportunities", filters],
    queryFn: async () => {
      const response = await fetch(`/api/opportunities${queryString ? `?${queryString}` : ""}`);
      return response.json();
    },
  });
}
