"use client";

import { useEffect, useRef, useState } from "react";

interface PipelineCardProps {
  title: string;
  funder?: string;
  deadline?: string;
  stage: string;
  onDelete?: () => void;
  isUpdating?: boolean;
}

const STAGE_ACCENT: Record<string, string> = {
  saved:       "border-l-slate-300",
  researching: "border-l-blue-400",
  drafting:    "border-l-violet-500",
  submitted:   "border-l-amber-500",
  awarded:     "border-l-emerald-500",
  rejected:    "border-l-red-400",
};

const CONFIRM_TIMEOUT_MS = 4000;

export default function PipelineCard({ title, funder, deadline, stage, onDelete, isUpdating }: PipelineCardProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const confirmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
    };
  }, []);

  function clearConfirmTimeout() {
    if (confirmTimeoutRef.current) {
      clearTimeout(confirmTimeoutRef.current);
      confirmTimeoutRef.current = null;
    }
  }

  function startConfirm(e: React.MouseEvent) {
    e.stopPropagation();
    setConfirmingDelete(true);
    clearConfirmTimeout();
    confirmTimeoutRef.current = setTimeout(() => {
      setConfirmingDelete(false);
    }, CONFIRM_TIMEOUT_MS);
  }

  function cancelConfirm(e: React.MouseEvent) {
    e.stopPropagation();
    clearConfirmTimeout();
    setConfirmingDelete(false);
  }

  function confirmDelete(e: React.MouseEvent) {
    e.stopPropagation();
    clearConfirmTimeout();
    setConfirmingDelete(false);
    onDelete?.();
  }

  // Date.now() is impure and must not be called during render (React Compiler
  // purity rule). Capture "now" once via a lazy useState initializer (runs
  // only on mount, not on every render) and derive daysLeft from that fixed
  // snapshot — the render body itself stays a pure function of props + state.
  const [now] = useState(() => Date.now());
  const daysLeft = deadline ? Math.ceil((new Date(deadline).getTime() - now) / 86_400_000) : null;
  const urgent  = daysLeft !== null && daysLeft <= 7  && daysLeft >= 0;
  const warning = daysLeft !== null && daysLeft <= 21 && daysLeft > 7;
  const accentClass = STAGE_ACCENT[stage] ?? "border-l-slate-300";

  return (
    <article
      className={`group relative rounded-lg border border-slate-200 border-l-2 ${accentClass} bg-white p-3 shadow-sm transition hover:shadow-md hover:border-slate-300 cursor-pointer ${
        isUpdating ? "opacity-60 pointer-events-none" : ""
      }`}
    >
      {isUpdating && (
        <span
          aria-label="Updating"
          className="absolute right-1.5 top-1.5 h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-blue-500"
        />
      )}

      {!isUpdating && onDelete && (
        confirmingDelete ? (
          <div
            className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded-full bg-white px-1 py-0.5 shadow-sm ring-1 ring-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-[9px] text-slate-400 pl-0.5">Remove?</span>
            <button
              type="button"
              aria-label="Confirm remove from pipeline"
              onClick={confirmDelete}
              className="flex h-4 w-4 items-center justify-center rounded-full text-emerald-600 hover:bg-emerald-50"
            >
              <span className="text-xs leading-none">✓</span>
            </button>
            <button
              type="button"
              aria-label="Cancel remove from pipeline"
              onClick={cancelConfirm}
              className="flex h-4 w-4 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
            >
              <span className="text-xs leading-none">×</span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            aria-label="Remove from pipeline"
            onClick={startConfirm}
            className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full text-slate-300 opacity-0 transition hover:bg-slate-100 hover:text-slate-500 group-hover:opacity-100"
          >
            <span className="text-xs leading-none">×</span>
          </button>
        )
      )}

      <p className="text-xs font-semibold leading-snug text-slate-800 line-clamp-2 pr-4 group-hover:text-blue-600 transition">
        {title}
      </p>

      {funder && (
        <p className="mt-1 text-[11px] text-slate-400 truncate">{funder}</p>
      )}

      {deadline && (
        <div className="mt-2">
          <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            urgent  ? "bg-red-50 text-red-600" :
            warning ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-400"
          }`}>
            {daysLeft === 0
              ? "Due today"
              : daysLeft !== null && daysLeft > 0
              ? `${daysLeft}d left`
              : new Date(deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        </div>
      )}
    </article>
  );
}
