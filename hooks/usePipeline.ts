import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function usePipeline() {
  return useQuery({
    queryKey: ["pipeline"],
    queryFn: async () => {
      const response = await fetch("/api/pipeline");
      return response.json();
    },
  });
}

export interface AddToPipelineInput {
  opportunity_id: string;
  title: string;
  match_id?: string;
  deadline?: string | null;
  stage?: string;
}

export function useAddToPipeline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AddToPipelineInput) => {
      const response = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: "saved", ...input }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to add to pipeline");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
    },
  });
}
