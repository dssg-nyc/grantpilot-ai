"use client";

import { Plus, MessageSquare, Trash2, FileText, AlertCircle } from "lucide-react";
import { useConversations, useCreateConversation, useDeleteConversation } from "@/hooks/useAssistant";

export default function ConversationSidebar({
  activeId,
  onSelect,
}: {
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  const { data: conversations, isLoading } = useConversations();
  const createConversation = useCreateConversation();
  const deleteConversation = useDeleteConversation();

  function handleNew() {
    createConversation.mutate({}, { onSuccess: (conv) => onSelect(conv.id) });
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-slate-100 bg-white">
      <div className="space-y-2 p-3">
        <button
          onClick={handleNew}
          disabled={createConversation.isPending}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          New conversation
        </button>
        {createConversation.isError && (
          <p className="flex items-start gap-1.5 text-xs text-red-600">
            <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
            {createConversation.error instanceof Error ? createConversation.error.message : "Couldn't start a new conversation."}
          </p>
        )}
      </div>

      <div className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
        {isLoading && <p className="px-2 py-4 text-center text-xs text-slate-400">Loading…</p>}
        {!isLoading && conversations?.length === 0 && (
          <p className="px-2 py-4 text-center text-xs text-slate-400">No conversations yet</p>
        )}
        {conversations?.map((c) => (
          <div
            key={c.id}
            className={`group flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition ${
              c.id === activeId ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <button onClick={() => onSelect(c.id)} className="flex flex-1 items-center gap-2 truncate text-left">
              {c.pipeline_item_id ? (
                <FileText className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              ) : (
                <MessageSquare className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              )}
              <span className="truncate">{c.title}</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteConversation.mutate(c.id, {
                  onSuccess: () => {
                    if (c.id === activeId) onSelect("");
                  },
                });
              }}
              className="shrink-0 rounded p-1 text-slate-300 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
              aria-label="Delete conversation"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}
