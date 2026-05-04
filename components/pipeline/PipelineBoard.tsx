"use client";

import PipelineColumn from "@/components/pipeline/PipelineColumn";
import { usePipeline } from "@/hooks/usePipeline";

const STAGES = ["saved", "researching", "drafting", "submitted", "awarded", "rejected"] as const;

interface PipelineItem {
  id: string;
  stage: string;
  title: string;
  notes?: string;
  deadline?: string;
  opportunity?: { title: string; funder_name: string } | null;
}

export default function PipelineBoard() {
  const { data: items, isLoading } = usePipeline();
  const allItems: PipelineItem[] = Array.isArray(items) ? items : [];

  if (isLoading) {
    return (
      <div className="grid gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {STAGES.map((s) => (
          <div key={s} className="h-52 animate-pulse rounded-xl bg-slate-100 border border-slate-200" />
        ))}
      </div>
    );
  }

  const total = allItems.length;

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span className="font-medium text-slate-700">{total}</span>
        {total === 1 ? "grant" : "grants"} in pipeline
        {STAGES.filter((s) => allItems.some((i) => i.stage === s)).map((s) => {
          const count = allItems.filter((i) => i.stage === s).length;
          return (
            <span key={s} className="rounded-full bg-slate-100 px-2 py-0.5 capitalize">
              {count} {s}
            </span>
          );
        })}
      </div>

      {/* Board */}
      <div className="grid gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {STAGES.map((stage) => (
          <PipelineColumn
            key={stage}
            stage={stage}
            items={allItems.filter((i) => i.stage === stage)}
          />
        ))}
      </div>
    </div>
  );
}
