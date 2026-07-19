import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PipelineItem } from "@/types/pipeline";

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
  opportunity_id?: string;
  title: string;
  match_id?: string;
  notes?: string | null;
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

export function useUpdatePipelineStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      const response = await fetch(`/api/pipeline/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to update stage");
      }
      return response.json();
    },
    onMutate: async ({ id, stage }) => {
      await queryClient.cancelQueries({ queryKey: ["pipeline"] });
      const previous = queryClient.getQueryData<PipelineItem[]>(["pipeline"]);
      queryClient.setQueryData<PipelineItem[]>(["pipeline"], (old) =>
        Array.isArray(old)
          ? old.map((item) =>
              item.id === id ? { ...item, stage: stage as PipelineItem["stage"] } : item,
            )
          : old,
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(["pipeline"], context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
    },
  });
}

export function useDeletePipelineItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/pipeline/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to remove from pipeline");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
    },
  });
}

export interface DraftAssistance {
  mission_alignment: string;
  why_this_funder: string;
  budget_narrative_starter: string;
  key_talking_points: string[];
  suggested_next_steps: string[];
}

export function usePipelineDraft(pipelineItemId: string | null) {
  return useQuery({
    queryKey: ["pipeline-draft", pipelineItemId],
    queryFn: async () => {
      const response = await fetch(`/api/pipeline/${pipelineItemId}/draft`);
      return response.json() as Promise<{ draft: DraftAssistance | null }>;
    },
    enabled: !!pipelineItemId,
  });
}

export function useGenerateDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (pipelineItemId: string) => {
      const response = await fetch(`/api/pipeline/${pipelineItemId}/draft`, { method: "POST" });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to generate draft");
      }
      return response.json() as Promise<{ draft: DraftAssistance; drafts_remaining_this_month: number | null }>;
    },
    onSuccess: (_data, pipelineItemId) => {
      queryClient.invalidateQueries({ queryKey: ["pipeline-draft", pipelineItemId] });
      queryClient.invalidateQueries({ queryKey: ["billing-usage"] });
    },
  });
}
