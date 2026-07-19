import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { act } from "react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useUpdatePipelineStage } from "@/hooks/usePipeline";
import type { PipelineItem } from "@/types/pipeline";

const initialItems: PipelineItem[] = [
  { id: "1", org_id: "org-1", title: "Grant A", stage: "saved" },
  { id: "2", org_id: "org-1", title: "Grant B", stage: "researching" },
];

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  queryClient.setQueryData(["pipeline"], initialItems);
  const wrapper = makeWrapper(queryClient);
  return { queryClient, wrapper };
}

describe("useUpdatePipelineStage", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("applies the stage change to the cache immediately (optimistic update), before the request resolves", async () => {
    const { queryClient, wrapper } = setup();

    // fetch() never resolves during this test — we only care about the
    // synchronous cache write that onMutate performs.
    (global.fetch as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useUpdatePipelineStage(), { wrapper });

    act(() => {
      result.current.mutate({ id: "1", stage: "drafting" });
    });

    await waitFor(() => {
      const cached = queryClient.getQueryData<PipelineItem[]>(["pipeline"]);
      expect(cached?.find((i) => i.id === "1")?.stage).toBe("drafting");
    });

    // The untouched item must remain exactly as it was.
    const cached = queryClient.getQueryData<PipelineItem[]>(["pipeline"]);
    expect(cached?.find((i) => i.id === "2")?.stage).toBe("researching");
  });

  it("rolls back to the prior cache state when the mutation fails", async () => {
    const { queryClient, wrapper } = setup();

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Failed to update stage" }),
    });

    const { result } = renderHook(() => useUpdatePipelineStage(), { wrapper });

    act(() => {
      result.current.mutate({ id: "1", stage: "drafting" });
    });

    // The mutation rejects (mocked fetch resolves with ok:false), so onError
    // should restore the pre-mutation snapshot captured by onMutate.
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    const cached = queryClient.getQueryData<PipelineItem[]>(["pipeline"]);
    expect(cached?.find((i) => i.id === "1")?.stage).toBe("saved");
    expect(cached).toEqual(initialItems);
  });

  it("invalidates the pipeline query after settling, so the cache reconciles with the server", async () => {
    const { queryClient, wrapper } = setup();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ id: "1", stage: "drafting" }),
    });

    const { result } = renderHook(() => useUpdatePipelineStage(), { wrapper });

    act(() => {
      result.current.mutate({ id: "1", stage: "drafting" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["pipeline"] });
  });
});
