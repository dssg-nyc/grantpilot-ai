"use client";

import { History, Trash2, CircleDot, CircleCheck, CircleAlert } from "lucide-react";
import type { ScoutRun } from "@/types/scout";
import { useDeleteScoutRun } from "@/hooks/useScout";

const STATUS_META = {
  running: { Icon: CircleDot, tone: "text-blue-500", label: "Running" },
  completed: { Icon: CircleCheck, tone: "text-emerald-500", label: "Done" },
  failed: { Icon: CircleAlert, tone: "text-amber-500", label: "Incomplete" },
} as const;

function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const mins = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function RunHistory({
  runs,
  activeRunId,
  onSelect,
}: {
  runs: ScoutRun[];
  activeRunId: string | null;
  onSelect: (id: string) => void;
}) {
  const deleteRun = useDeleteScoutRun();

  if (runs.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <History className="h-3.5 w-3.5 text-slate-400" />
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Past runs</p>
      </div>
      <ul className="mt-3 space-y-1">
        {runs.map((run) => {
          const meta = STATUS_META[run.status] ?? STATUS_META.completed;
          const active = run.id === activeRunId;
          const label =
            run.scope === "project" && run.project_name ? run.project_name : "Whole organization";
          return (
            <li key={run.id} className="group flex items-center gap-1">
              <button
                onClick={() => onSelect(run.id)}
                className={`min-w-0 flex-1 rounded-lg px-2.5 py-2 text-left transition ${
                  active ? "bg-blue-50" : "hover:bg-slate-50"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <meta.Icon className={`h-3 w-3 shrink-0 ${meta.tone}`} />
                  <span
                    className={`truncate text-sm ${active ? "font-medium text-blue-800" : "text-slate-700"}`}
                  >
                    {label}
                  </span>
                </span>
                <span className="mt-0.5 block pl-4.5 text-[11px] text-slate-400">
                  {run.finding_count} found · {when(run.started_at)}
                </span>
              </button>
              <button
                onClick={() => deleteRun.mutate(run.id)}
                aria-label={`Delete run: ${label}`}
                className="shrink-0 rounded-md p-1.5 text-slate-300 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
