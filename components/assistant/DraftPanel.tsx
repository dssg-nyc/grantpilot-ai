"use client";

import { useState } from "react";
import { FileText, Check, Pencil, Copy, CheckCheck } from "lucide-react";
import { GRANT_SECTION_KEYS, GRANT_SECTIONS, type GrantSectionKey } from "@/lib/utils/grant-sections";
import { useGrantDraft, useUpdateGrantDraftSection } from "@/hooks/useGrantDraft";

function SectionEditor({
  sectionKey,
  content,
  status,
  pipelineItemId,
}: {
  sectionKey: GrantSectionKey;
  content: string;
  status: "draft" | "reviewed";
  pipelineItemId: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(content);
  const [copied, setCopied] = useState(false);
  const [prevContent, setPrevContent] = useState(content);
  const update = useUpdateGrantDraftSection(pipelineItemId);

  // Reset the editable draft whenever the persisted content changes (e.g. the
  // assistant just wrote a new version) — the react.dev-recommended pattern
  // for adjusting state during render instead of in an effect.
  if (content !== prevContent) {
    setPrevContent(content);
    setDraft(content);
  }

  function handleCopy() {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-slate-800">{GRANT_SECTIONS[sectionKey].label}</p>
          {status === "reviewed" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
              <Check className="h-2.5 w-2.5" /> Reviewed
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Copy section"
          >
            {copied ? <CheckCheck className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={() => setEditing((v) => !v)}
            className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Edit section"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {editing ? (
        <div className="space-y-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={8}
            className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                update.mutate({ section_key: sectionKey, content: draft, status: "reviewed" });
                setEditing(false);
              }}
              disabled={update.isPending}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
            >
              Save & mark reviewed
            </button>
            <button
              onClick={() => {
                setDraft(content);
                setEditing(false);
              }}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{content}</p>
      )}
    </div>
  );
}

export default function DraftPanel({ pipelineItemId }: { pipelineItemId: string | null }) {
  const { data: sections, isLoading } = useGrantDraft(pipelineItemId);

  if (!pipelineItemId) {
    return (
      <aside className="flex w-96 shrink-0 flex-col items-center justify-center gap-2 border-l border-slate-100 bg-slate-50 p-6 text-center">
        <FileText className="h-6 w-6 text-slate-300" />
        <p className="text-xs text-slate-400">
          This conversation isn&apos;t linked to a grant application. Start one from a pipeline item to see drafted
          sections here as the assistant writes them.
        </p>
      </aside>
    );
  }

  const sectionMap = new Map((sections ?? []).map((s) => [s.section_key, s]));
  const completedCount = sectionMap.size;

  return (
    <aside className="flex w-96 shrink-0 flex-col border-l border-slate-100 bg-slate-50">
      <div className="border-b border-slate-100 bg-white px-4 py-3.5">
        <p className="text-sm font-semibold text-slate-800">Application Draft</p>
        <p className="text-xs text-slate-400">{completedCount} of {GRANT_SECTION_KEYS.length} sections drafted</p>
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-indigo-500 transition-all"
            style={{ width: `${(completedCount / GRANT_SECTION_KEYS.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {isLoading && <p className="text-xs text-slate-400">Loading draft…</p>}
        {GRANT_SECTION_KEYS.map((key) => {
          const section = sectionMap.get(key);
          if (!section) {
            return (
              <div key={key} className="rounded-xl border border-dashed border-slate-200 bg-white/50 p-4">
                <p className="text-sm font-medium text-slate-400">{GRANT_SECTIONS[key].label}</p>
                <p className="mt-1 text-xs text-slate-300">Not written yet — ask the assistant to draft this section.</p>
              </div>
            );
          }
          return (
            <SectionEditor
              key={key}
              sectionKey={key}
              content={section.content}
              status={section.status}
              pipelineItemId={pipelineItemId}
            />
          );
        })}
      </div>
    </aside>
  );
}
