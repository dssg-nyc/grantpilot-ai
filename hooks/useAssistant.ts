import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface Conversation {
  id: string;
  title: string;
  pipeline_item_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ToolCallLogEntry {
  name: string;
  input: unknown;
  result: unknown;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  tool_calls: ToolCallLogEntry[] | null;
  created_at: string;
  // Client-only, for the message currently streaming in.
  streaming?: boolean;
}

/**
 * Deliberately does NOT auto-redirect on 401: a single request 401'ing isn't
 * reliable proof the session is dead (transient Supabase token-refresh races
 * are possible when several API calls fire in parallel on page load), and
 * redirecting to /login when the session is actually still valid just
 * bounces the user right back to /dashboard via proxy.ts's own auth check —
 * an unrecoverable loop. Surface a clear, retryable error instead and let
 * the UI offer a manual "log in again" path.
 */
async function throwIfNotOk(res: Response, fallbackMessage: string): Promise<void> {
  if (res.ok) return;
  if (res.status === 401) {
    throw new Error("SESSION_EXPIRED");
  }
  const body = await res.json().catch(() => ({}));
  throw new Error(body.error ?? fallbackMessage);
}

export function useConversations() {
  return useQuery({
    queryKey: ["assistant-conversations"],
    queryFn: async () => {
      const res = await fetch("/api/assistant/conversations");
      await throwIfNotOk(res, "Failed to load conversations");
      const json = await res.json();
      return json.conversations as Conversation[];
    },
  });
}

export function useCreateConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { pipeline_item_id?: string; title?: string } = {}) => {
      const res = await fetch("/api/assistant/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      await throwIfNotOk(res, "Failed to create conversation");
      const json = await res.json();
      return json.conversation as Conversation;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["assistant-conversations"] }),
  });
}

export function useDeleteConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/assistant/conversations/${id}`, { method: "DELETE" });
      await throwIfNotOk(res, "Failed to delete conversation");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["assistant-conversations"] }),
  });
}

interface StreamEvent {
  type: "text_delta" | "tool_call_start" | "tool_call_end" | "error" | "done";
  text?: string;
  name?: string;
  input?: unknown;
  result?: unknown;
  message?: string;
  finalText?: string;
}

/**
 * Drives one conversation: loads its history, and exposes sendMessage() which
 * streams the assistant's reply token-by-token via SSE, surfacing tool
 * activity as it happens rather than only showing the final text.
 */
export function useAssistantChat(conversationId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // No reset-to-[] here: the caller remounts this hook's owning component
    // via `key={conversationId}` on a conversation switch, so `messages`
    // already starts fresh from its initial state — this effect only needs
    // to populate it once history arrives.
    if (!conversationId) return;
    let cancelled = false;
    fetch(`/api/assistant/conversations/${conversationId}`)
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled && json.messages) setMessages(json.messages);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load this conversation.");
      });
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!conversationId || !text.trim() || isStreaming) return;
      setError(null);

      const userMsg: ChatMessage = {
        id: `local-${Date.now()}`,
        role: "user",
        content: text,
        tool_calls: null,
        created_at: new Date().toISOString(),
      };
      const assistantMsg: ChatMessage = {
        id: `local-streaming-${Date.now()}`,
        role: "assistant",
        content: "",
        tool_calls: [],
        created_at: new Date().toISOString(),
        streaming: true,
      };
      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;
      const pendingCalls: ToolCallLogEntry[] = [];

      try {
        const res = await fetch("/api/assistant/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversation_id: conversationId, message: text }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          await throwIfNotOk(res, "The assistant couldn't respond right now.");
          throw new Error("The assistant couldn't respond right now.");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const event: StreamEvent = JSON.parse(line.slice(6));

            if (event.type === "text_delta" && event.text) {
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: m.content + event.text } : m)),
              );
            } else if (event.type === "tool_call_start" && event.name) {
              pendingCalls.push({ name: event.name, input: event.input, result: undefined });
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantMsg.id ? { ...m, tool_calls: [...pendingCalls] } : m)),
              );
            } else if (event.type === "tool_call_end" && event.name) {
              const entry = [...pendingCalls].reverse().find((c) => c.name === event.name && c.result === undefined);
              if (entry) entry.result = event.result;
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantMsg.id ? { ...m, tool_calls: [...pendingCalls] } : m)),
              );
            } else if (event.type === "error") {
              setError(event.message ?? "Something went wrong.");
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          setError(err.message);
        }
      } finally {
        setMessages((prev) => prev.map((m) => (m.id === assistantMsg.id ? { ...m, streaming: false } : m)));
        setIsStreaming(false);
        queryClient.invalidateQueries({ queryKey: ["assistant-conversations"] });
        // Tool calls may have mutated pipeline/drafts/matches — refresh dependents.
        queryClient.invalidateQueries({ queryKey: ["pipeline"] });
        queryClient.invalidateQueries({ queryKey: ["grant-draft"] });
      }
    },
    [conversationId, isStreaming, queryClient],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { messages, sendMessage, isStreaming, error, stop };
}
