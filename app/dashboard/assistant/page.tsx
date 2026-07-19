"use client";

import { Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles, AlertCircle, RotateCw } from "lucide-react";
import ConversationSidebar from "@/components/assistant/ConversationSidebar";
import ChatWindow from "@/components/assistant/ChatWindow";
import DraftPanel from "@/components/assistant/DraftPanel";
import { useConversations, useCreateConversation } from "@/hooks/useAssistant";

function AssistantPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: conversations, isError, error, refetch, isLoading } = useConversations();
  const createConversation = useCreateConversation();

  // The URL is the single source of truth for which conversation is active —
  // no duplicate local state to keep in sync with it.
  const activeId = searchParams.get("c");
  const pipelineItemParam = searchParams.get("pipeline_item_id");
  const autoCreateAttemptedRef = useRef(false);

  // Deep-link from a pipeline item: find or create a conversation scoped to it.
  useEffect(() => {
    if (!pipelineItemParam || autoCreateAttemptedRef.current || !conversations) return;
    autoCreateAttemptedRef.current = true;
    const existing = conversations.find((c) => c.pipeline_item_id === pipelineItemParam);
    if (existing) {
      router.replace(`/dashboard/assistant?c=${existing.id}`);
    } else {
      createConversation.mutate(
        { pipeline_item_id: pipelineItemParam, title: "Grant application draft" },
        { onSuccess: (conv) => router.replace(`/dashboard/assistant?c=${conv.id}`) },
      );
    }
  }, [pipelineItemParam, conversations, createConversation, router]);

  function handleSelect(id: string) {
    router.replace(id ? `/dashboard/assistant?c=${id}` : "/dashboard/assistant");
  }

  const activeConversation = conversations?.find((c) => c.id === activeId);

  if (isError) {
    const message = error instanceof Error ? error.message : "Something went wrong.";
    const sessionExpired = message === "SESSION_EXPIRED";
    const needsOnboarding = message === "Complete your organization profile first.";
    return (
      <div className="-m-6 flex h-[calc(100vh-57px)] flex-col items-center justify-center gap-3 text-center">
        <AlertCircle className="h-6 w-6 text-red-400" />
        <p className="text-sm font-medium text-slate-700">
          {sessionExpired
            ? "Your session couldn't be verified."
            : needsOnboarding
              ? "Finish setting up your organization first"
              : "Couldn't load the assistant."}
        </p>
        <p className="max-w-sm text-xs text-slate-400">
          {sessionExpired
            ? "This can happen briefly after a long idle period. Try again, or log in again if it persists."
            : needsOnboarding
              ? "The assistant needs your organization profile to give useful, grounded answers — it only takes a couple of minutes."
              : message}
        </p>
        <div className="flex items-center gap-2">
          {needsOnboarding ? (
            <a
              href="/onboarding"
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
            >
              Complete your profile
            </a>
          ) : (
            <button
              onClick={() => refetch()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              <RotateCw className="h-3.5 w-3.5" />
              Try again
            </button>
          )}
          {sessionExpired && (
            <a
              href="/login?next=/dashboard/assistant"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Log in again
            </a>
          )}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <div className="-m-6 flex h-[calc(100vh-57px)] items-center justify-center text-sm text-slate-400">Loading…</div>;
  }

  return (
    <div className="-m-6 flex h-[calc(100vh-57px)] overflow-hidden">
      <ConversationSidebar activeId={activeId} onSelect={handleSelect} />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-slate-100 bg-white px-6 py-3.5">
          <Sparkles className="h-4 w-4 text-blue-600" />
          <p className="text-sm font-semibold text-slate-800">
            {activeConversation?.title ?? "GrantPilot Assistant"}
          </p>
        </div>
        <ChatWindow key={activeId} conversationId={activeId} />
      </div>

      <DraftPanel pipelineItemId={activeConversation?.pipeline_item_id ?? null} />
    </div>
  );
}

export default function AssistantPage() {
  return (
    <Suspense fallback={<div className="flex h-96 items-center justify-center text-sm text-slate-400">Loading…</div>}>
      <AssistantPageInner />
    </Suspense>
  );
}
