import { useCallback, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ScoutFinding, ScoutRequest, ScoutRun, ScoutRunWithFindings } from "@/types/scout";

async function throwIfNotOk(res: Response, fallbackMessage: string): Promise<void> {
  if (res.ok) return;
  if (res.status === 401) throw new Error("SESSION_EXPIRED");
  const body = await res.json().catch(() => ({}));
  throw new Error(body.error ?? fallbackMessage);
}

export function useScoutRuns() {
  return useQuery({
    queryKey: ["scout-runs"],
    queryFn: async () => {
      const res = await fetch("/api/scout/runs");
      await throwIfNotOk(res, "Failed to load past research runs");
      const json = await res.json();
      return json.runs as ScoutRun[];
    },
  });
}

export function useScoutRun(runId: string | null) {
  return useQuery({
    queryKey: ["scout-run", runId],
    enabled: !!runId,
    queryFn: async () => {
      const res = await fetch(`/api/scout/runs/${runId}`);
      await throwIfNotOk(res, "Failed to load this research run");
      const json = await res.json();
      return json.run as ScoutRunWithFindings;
    },
  });
}

export function useDeleteScoutRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/scout/runs/${id}`, { method: "DELETE" });
      await throwIfNotOk(res, "Failed to delete this run");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["scout-runs"] }),
  });
}

export interface ImportResult {
  opportunity_id: string;
  pipeline_item_id: string | null;
  plan_limited?: boolean;
  already_imported?: boolean;
}

export function useImportFinding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (findingId: string) => {
      const res = await fetch(`/api/scout/findings/${findingId}/import`, { method: "POST" });
      await throwIfNotOk(res, "Couldn't add this opportunity to your pipeline");
      return (await res.json()) as ImportResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["matches"] });
    },
  });
}

export interface ScoutActivity {
  label: string;
  detail?: string;
  at: number;
}

interface StreamEvent {
  type: "activity" | "finding" | "summary_delta" | "error" | "done";
  label?: string;
  detail?: string;
  finding?: ScoutFinding;
  text?: string;
  message?: string;
  summary?: string;
}

/**
 * Runs one funding-scout research job, streaming activity and findings as
 * they land.
 *
 * The stream is a live view, not the record of truth: the server persists
 * every finding the instant the agent records it, so when the stream ends —
 * cleanly, on a platform function timeout, or because the user's connection
 * dropped — the caller refetches the run from the database and renders that
 * instead. That is why `runId` is captured from the very first event.
 */
export function useScoutSession() {
  const [runId, setRunId] = useState<string | null>(null);
  const [findings, setFindings] = useState<ScoutFinding[]>([]);
  const [activity, setActivity] = useState<ScoutActivity[]>([]);
  const [summary, setSummary] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const queryClient = useQueryClient();

  const start = useCallback(
    async (request: ScoutRequest) => {
      if (isRunning) return;

      setRunId(null);
      setFindings([]);
      setActivity([]);
      setSummary("");
      setError(null);
      setIsRunning(true);

      const controller = new AbortController();
      abortRef.current = controller;
      let startedRunId: string | null = null;

      try {
        const res = await fetch("/api/scout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          await throwIfNotOk(res, "Couldn't start the research run.");
          throw new Error("Couldn't start the research run.");
        }

        startedRunId = res.headers.get("X-Scout-Run-Id");
        if (startedRunId) setRunId(startedRunId);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const chunks = buffer.split("\n\n");
          buffer = chunks.pop() ?? "";

          for (const chunk of chunks) {
            if (!chunk.startsWith("data: ")) continue;
            const event: StreamEvent = JSON.parse(chunk.slice(6));

            if (event.type === "activity" && event.label) {
              if (event.label === "Starting research run" && event.detail && !startedRunId) {
                startedRunId = event.detail;
                setRunId(event.detail);
              }
              setActivity((prev) => [
                ...prev.slice(-40),
                { label: event.label!, detail: event.detail, at: Date.now() },
              ]);
            } else if (event.type === "finding" && event.finding) {
              const found = event.finding;
              setFindings((prev) =>
                [...prev, found].sort((a, b) => b.fit_score - a.fit_score),
              );
            } else if (event.type === "summary_delta" && event.text) {
              setSummary((prev) => prev + event.text);
            } else if (event.type === "error" && event.message) {
              setError(event.message);
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          setError("Research run stopped.");
        } else if (err instanceof Error) {
          // A dropped connection mid-run is expected on short function
          // timeouts. Anything already found is safe in the database.
          setError(
            startedRunId
              ? `${err.message} Findings recorded before this point are saved below.`
              : err.message,
          );
        }
      } finally {
        setIsRunning(false);
        queryClient.invalidateQueries({ queryKey: ["scout-runs"] });
        if (startedRunId) {
          queryClient.invalidateQueries({ queryKey: ["scout-run", startedRunId] });
        }
      }
    },
    [isRunning, queryClient],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  return { runId, findings, activity, summary, isRunning, error, start, stop };
}
