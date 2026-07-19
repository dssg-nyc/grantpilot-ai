import { useMutation, useQuery } from "@tanstack/react-query";

export interface BillingUsage {
  plan: "free" | "pro";
  limits: {
    maxVisibleMatches: number;
    maxActivePipelineItems: number;
    maxAIDraftsPerMonth: number;
  };
  usage: {
    activePipelineItems: number;
    aiDraftsThisMonth: number;
    totalMatches: number;
  };
}

export function useBillingUsage() {
  return useQuery({
    queryKey: ["billing-usage"],
    queryFn: async () => {
      const response = await fetch("/api/billing/usage");
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to load billing usage");
      }
      return response.json() as Promise<BillingUsage>;
    },
  });
}

export function useStartCheckout() {
  return useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/billing/checkout", { method: "POST" });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to start checkout");
      }
      return response.json() as Promise<{ url: string }>;
    },
  });
}

export function useOpenBillingPortal() {
  return useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/billing/portal", { method: "POST" });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to open billing portal");
      }
      return response.json() as Promise<{ url: string }>;
    },
  });
}
