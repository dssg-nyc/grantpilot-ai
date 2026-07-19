import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { GrantSectionKey } from "@/lib/utils/grant-sections";

export interface GrantDraftSection {
  section_key: GrantSectionKey;
  content: string;
  status: "draft" | "reviewed";
  updated_at: string;
}

export function useGrantDraft(pipelineItemId: string | null) {
  return useQuery({
    queryKey: ["grant-draft", pipelineItemId],
    queryFn: async () => {
      const res = await fetch(`/api/pipeline/${pipelineItemId}/grant-draft`);
      if (!res.ok) throw new Error("Failed to load draft");
      const json = await res.json();
      return json.sections as GrantDraftSection[];
    },
    enabled: !!pipelineItemId,
  });
}

export function useUpdateGrantDraftSection(pipelineItemId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { section_key: GrantSectionKey; content: string; status?: "draft" | "reviewed" }) => {
      const res = await fetch(`/api/pipeline/${pipelineItemId}/grant-draft`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error("Failed to save section");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["grant-draft", pipelineItemId] }),
  });
}
