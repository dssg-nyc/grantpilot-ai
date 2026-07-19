"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Bot, ArrowRight } from "lucide-react";
import type { PipelineItem } from "@/types/pipeline";
import { usePipelineDraft, useGenerateDraft } from "@/hooks/usePipeline";

interface PipelineItemDetailModalProps {
  item: PipelineItem | null;
  onClose: () => void;
}

const STAGE_LABELS: Record<string, string> = {
  saved: "Saved",
  researching: "Researching",
  drafting: "Drafting",
  submitted: "Submitted",
  awarded: "Awarded",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

export default function PipelineItemDetailModal({ item, onClose }: PipelineItemDetailModalProps) {
  const open = !!item;
  const draftQuery = usePipelineDraft(item?.id ?? null);
  const generateDraft = useGenerateDraft();

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    // Reset mutation state whenever the open item changes (including closing),
    // otherwise a stale draft/error from a previous item could leak into this one.
    generateDraft.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  if (!item) return null;

  const hasOpportunity = !!item.opportunity_id;
  const title = item.opportunity?.title ?? item.title;
  const funder = item.opportunity?.funder_name;
  const draft = generateDraft.data?.draft ?? draftQuery.data?.draft ?? null;
  const draftsRemaining = generateDraft.data?.drafts_remaining_this_month;

  function handleGenerate() {
    if (!item) return;
    generateDraft.mutate(item.id);
  }

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Grant details"
          className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl"
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
              {funder && <p className="mt-0.5 text-sm text-gray-500">{funder}</p>}
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="shrink-0 text-gray-400 hover:text-gray-600"
            >
              <span className="text-xl leading-none">×</span>
            </button>
          </div>

          {/* Basic info */}
          <div className="mb-6 grid grid-cols-2 gap-4 rounded-md bg-slate-50 p-3 text-sm">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Stage</p>
              <p className="mt-0.5 text-slate-700">{STAGE_LABELS[item.stage] ?? item.stage}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Deadline</p>
              <p className="mt-0.5 text-slate-700">
                {item.deadline
                  ? new Date(item.deadline).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "—"}
              </p>
            </div>
            {item.notes && (
              <div className="col-span-2">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Notes</p>
                <p className="mt-0.5 whitespace-pre-wrap text-slate-700">{item.notes}</p>
              </div>
            )}
          </div>

          {/* AI Assistant — full conversational drafting */}
          <div className="border-t border-gray-200 pt-5">
            <Link
              href={`/dashboard/assistant?pipeline_item_id=${item.id}`}
              className="group flex items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3.5 transition hover:border-blue-200 hover:bg-blue-50"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-700 to-blue-900">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">Draft with AI Assistant</p>
                  <p className="text-xs text-slate-500">
                    Build a full, section-by-section application through a conversation
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-blue-600 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          {/* Quick AI Draft Assistance */}
          <div className="border-t border-gray-200 pt-5">
            <h3 className="text-sm font-semibold text-gray-900">Quick Draft Assistance</h3>
            <p className="mt-1 text-xs text-gray-500">
              A fast, single-shot starting point — mission alignment, funder fit, a budget
              narrative starter, and talking points. Always review and edit before you submit;
              this isn&apos;t finished copy.
            </p>

            <div className="mt-4">
              {!hasOpportunity ? (
                <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-500">
                  AI drafting is only available for grants from your matches or opportunities —
                  this item was added manually.
                </div>
              ) : draftQuery.isLoading ? (
                <div className="text-sm text-gray-400">Loading…</div>
              ) : (
                <>
                  {generateDraft.isError && (
                    <div className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700">
                      {generateDraft.error instanceof Error
                        ? generateDraft.error.message
                        : "Failed to generate draft"}
                    </div>
                  )}

                  {generateDraft.isPending && (
                    <div className="flex items-center gap-2 rounded-md bg-blue-50 p-3 text-sm text-blue-700">
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-blue-300 border-t-blue-600" />
                      Generating your draft… this can take a few seconds.
                    </div>
                  )}

                  {!generateDraft.isPending && draft && (
                    <div className="space-y-4">
                      <DraftSection title="Mission Alignment" body={draft.mission_alignment} />
                      <DraftSection title="Why This Funder" body={draft.why_this_funder} />
                      <DraftSection
                        title="Budget Narrative Starter"
                        body={draft.budget_narrative_starter}
                      />
                      <DraftList title="Key Talking Points" items={draft.key_talking_points} />
                      <DraftList title="Suggested Next Steps" items={draft.suggested_next_steps} />

                      <div className="flex items-center gap-3 pt-1">
                        <button
                          type="button"
                          onClick={handleGenerate}
                          disabled={generateDraft.isPending}
                          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                        >
                          Regenerate
                        </button>
                        {draftsRemaining !== undefined && draftsRemaining !== null && (
                          <span className="text-xs text-gray-400">
                            {draftsRemaining} draft{draftsRemaining === 1 ? "" : "s"} remaining
                            this month
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {!generateDraft.isPending && !draft && (
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handleGenerate}
                        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                      >
                        Generate Draft Assistance
                      </button>
                      {draftsRemaining !== undefined && draftsRemaining !== null && (
                        <span className="text-xs text-gray-400">
                          {draftsRemaining} draft{draftsRemaining === 1 ? "" : "s"} remaining
                          this month
                        </span>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DraftSection({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h4>
      <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{body}</p>
    </div>
  );
}

function DraftList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h4>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-gray-700">
        {items.map((entry, i) => (
          <li key={i}>{entry}</li>
        ))}
      </ul>
    </div>
  );
}
