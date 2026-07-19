"use client";

import { Landmark, User } from "lucide-react";
import ToolActivity from "@/components/assistant/ToolActivity";
import SimpleFormattedText from "@/components/assistant/SimpleFormattedText";
import type { ChatMessage } from "@/hooks/useAssistant";

export default function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
          isUser ? "bg-slate-200" : "bg-gradient-to-br from-blue-700 to-blue-900"
        }`}
      >
        {isUser ? <User className="h-3.5 w-3.5 text-slate-600" /> : <Landmark className="h-3.5 w-3.5 text-white" />}
      </div>

      <div className={`flex max-w-[75%] flex-col gap-2 ${isUser ? "items-end" : "items-start"}`}>
        {!!message.tool_calls?.length && (
          <div className="flex flex-wrap gap-1.5">
            {message.tool_calls.map((call, i) => (
              <ToolActivity key={i} call={call} />
            ))}
          </div>
        )}

        <div
          className={`rounded-2xl px-4 py-2.5 text-sm ${
            isUser
              ? "bg-blue-600 text-white"
              : "border border-slate-100 bg-white text-slate-700 shadow-sm"
          }`}
        >
          {message.content ? (
            isUser ? (
              <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
            ) : (
              <SimpleFormattedText text={message.content} />
            )
          ) : message.streaming ? (
            <span className="inline-flex gap-1">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-300 [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-300 [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-300" />
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
