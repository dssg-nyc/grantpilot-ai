"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Square, AlertCircle, Sparkles } from "lucide-react";
import MessageBubble from "@/components/assistant/MessageBubble";
import { useAssistantChat } from "@/hooks/useAssistant";

const SUGGESTIONS = [
  "What grants am I best matched to right now?",
  "Find me federal grants for youth mental health programs",
  "What's due in my pipeline this month?",
  "Help me draft a Statement of Need for my top match",
];

export default function ChatWindow({ conversationId }: { conversationId: string | null }) {
  const { messages, sendMessage, isStreaming, error, stop } = useAssistantChat(conversationId);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    sendMessage(input);
    setInput("");
  }

  if (!conversationId) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
        Select or start a conversation to begin.
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50">
              <Sparkles className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700">Ask me to find grants, check your pipeline, or draft an application</p>
              <p className="mt-1 text-xs text-slate-400">I work off your real profile and the live grant database — not generic advice.</p>
            </div>
            <div className="grid max-w-md grid-cols-1 gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-xs text-slate-600 transition hover:border-blue-300 hover:bg-blue-50/50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-slate-100 bg-white px-6 py-4">
        <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 focus-within:border-blue-400 focus-within:bg-white">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="Ask about grants, your pipeline, or draft a section…"
            rows={1}
            className="max-h-32 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none"
          />
          {isStreaming ? (
            <button
              type="button"
              onClick={stop}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-700 text-white transition hover:bg-slate-800"
              aria-label="Stop"
            >
              <Square className="h-3.5 w-3.5 fill-white" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Send"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
