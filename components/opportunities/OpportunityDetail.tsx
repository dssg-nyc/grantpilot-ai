"use client";

import { useEffect, useMemo, useState } from "react";
import {
  X, ExternalLink, Calendar, DollarSign, Globe, Building2,
  Tag, ClipboardList, Sparkles, ArrowUpRight,
} from "lucide-react";
import type { Opportunity } from "@/types/opportunity";

interface OpportunityDetailProps {
  id: string | null;
  onClose: () => void;
  onAddToPipeline?: (opp: Opportunity) => void;
  pipelineState?: "idle" | "pending" | "added";
}

function fmt(n: number) {
  return n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000 ? `$${(n / 1_000).toFixed(0)}K`
    : `$${n.toLocaleString()}`;
}

function formatAmount(min?: number | null, max?: number | null) {
  if (!min && !max) return "Not specified";
  if (min && max)   return `${fmt(min)} – ${fmt(max)}`;
  if (max)          return `Up to ${fmt(max)}`;
  return `From ${fmt(min!)}`;
}

function formatDeadline(deadline?: string | null, rolling?: boolean) {
  if (rolling)   return "Rolling deadline";
  if (!deadline) return "Not specified";
  const d = new Date(deadline);
  const diff = Math.ceil((d.getTime() - Date.now()) / 86_400_000);
  const label = d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  if (diff < 0)   return `Closed — ${label}`;
  if (diff === 0) return "Due today";
  if (diff <= 7)  return `${diff} days left — ${label}`;
  return label;
}

const FUNDER_LABELS: Record<string, string> = {
  federal_government: "Federal Government",
  state_government:   "State Government",
  local_government:   "Local Government",
  foundation:         "Foundation",
  corporate:          "Corporate",
  international:      "International",
  other:              "Other",
};

const FUNDER_COLORS: Record<string, string> = {
  federal_government: "bg-purple-50 text-purple-700 border-purple-200",
  foundation:         "bg-blue-50   text-blue-700   border-blue-200",
  corporate:          "bg-emerald-50 text-emerald-700 border-emerald-200",
  state_government:   "bg-orange-50 text-orange-700 border-orange-200",
};

export default function OpportunityDetail({ id, onClose, onAddToPipeline, pipelineState = "idle" }: OpportunityDetailProps) {
  const [opp, setOpp] = useState<Opportunity | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Captured once on mount rather than read via Date.now() during render —
  // the React Compiler flags Date.now() as an impure render-time call.
  const [now] = useState(() => Date.now());

  useEffect(() => {
    // When `id` clears, we don't need to reset `opp` here — the component
    // renders null below whenever `id` is falsy, so any stale data is never
    // shown, and a subsequent fetch overwrites it once a new id arrives.
    if (!id) return;
    Promise.resolve()
      .then(() => { setLoading(true); setError(null); })
      .then(() => fetch(`/api/opportunities/${id}`))
      .then((r) => r.json())
      .then((data) => { setOpp(data.data ?? data); setLoading(false); })
      .catch(() => { setError("Failed to load."); setLoading(false); });
  }, [id]);

  const daysLeft = useMemo(
    () =>
      opp?.deadline
        ? Math.ceil((new Date(opp.deadline).getTime() - now) / 86_400_000)
        : null,
    [opp, now],
  );

  if (!id) return null;
  const urgent = daysLeft !== null && daysLeft <= 14 && daysLeft >= 0;
  const badgeClass = FUNDER_COLORS[opp?.funder_type ?? ""] ?? "bg-slate-100 text-slate-600 border-slate-200";

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <aside
        className="relative flex h-full w-full max-w-lg flex-col bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-5 py-3.5 backdrop-blur-sm">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Grant Detail
          </span>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex flex-1 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-100 border-t-blue-600" />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="m-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        )}

        {!loading && opp && (
          <div className="flex flex-1 flex-col overflow-y-auto">
            {/* Hero section */}
            <div className="border-b border-slate-100 p-5">
              <div className="mb-2.5 flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badgeClass}`}>
                  {FUNDER_LABELS[opp.funder_type] ?? opp.funder_type}
                </span>
                {urgent && (
                  <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-600">
                    {daysLeft === 0 ? "Due today" : `${daysLeft} days left`}
                  </span>
                )}
                {opp.status === "active" && !urgent && (
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                    Active
                  </span>
                )}
              </div>
              <h2 className="text-lg font-bold leading-snug text-slate-900">{opp.title}</h2>
              <p className="mt-1 text-sm text-slate-500">{opp.funder_name}</p>
            </div>

            {/* AI Summary */}
            {opp.ai_summary && (
              <div className="mx-5 mt-4 rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
                <div className="mb-1.5 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">AI Summary</span>
                </div>
                <p className="text-sm leading-relaxed text-slate-700">{opp.ai_summary}</p>
              </div>
            )}

            {/* Metadata grid */}
            <div className="grid grid-cols-2 gap-3 p-5">
              {[
                { icon: DollarSign, label: "Grant Amount", value: formatAmount(opp.amount_min, opp.amount_max), highlight: false },
                {
                  icon: Calendar,
                  label: "Deadline",
                  value: formatDeadline(opp.deadline, opp.is_rolling_deadline),
                  highlight: urgent,
                },
                {
                  icon: Globe,
                  label: "Geography",
                  value: (opp.geographic_scope ?? "—").replace(/_/g, " "),
                  highlight: false,
                },
                { icon: Building2, label: "Type", value: opp.funding_type, highlight: false },
              ].map(({ icon: Icon, label, value, highlight }) => (
                <div
                  key={label}
                  className={`flex items-start gap-2.5 rounded-xl border p-3 ${
                    highlight ? "border-red-100 bg-red-50" : "border-slate-100 bg-slate-50"
                  }`}
                >
                  <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${highlight ? "text-red-400" : "text-slate-400"}`} />
                  <div>
                    <p className="text-[10px] text-slate-400">{label}</p>
                    <p className={`mt-0.5 text-xs font-semibold capitalize ${highlight ? "text-red-700" : "text-slate-800"}`}>
                      {value}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Focus Areas */}
            {opp.focus_areas?.length > 0 && (
              <div className="border-t border-slate-100 px-5 py-4">
                <div className="mb-2.5 flex items-center gap-2">
                  <Tag className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-xs font-semibold text-slate-700">Focus Areas</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {opp.focus_areas.map((area) => (
                    <span key={area} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                      {area}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            {opp.description && (
              <div className="border-t border-slate-100 px-5 py-4">
                <p className="mb-2 text-xs font-semibold text-slate-700">Description</p>
                <p className="text-sm leading-relaxed text-slate-600">
                  {opp.description.length > 700
                    ? `${opp.description.substring(0, 700)}…`
                    : opp.description}
                </p>
              </div>
            )}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Actions footer */}
            <div className="sticky bottom-0 border-t border-slate-200 bg-white p-4 space-y-2.5 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
              {(opp.application_url || opp.source_url) && (
                <a
                  href={opp.application_url ?? opp.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700"
                >
                  Apply Now <ExternalLink className="h-4 w-4" />
                </a>
              )}
              {onAddToPipeline && (
                <button
                  onClick={() => { if (pipelineState === "idle") onAddToPipeline(opp); }}
                  disabled={pipelineState !== "idle"}
                  className={`flex w-full items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-semibold transition disabled:cursor-default ${
                    pipelineState === "added"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <ClipboardList className="h-3.5 w-3.5" />
                  {pipelineState === "pending" ? "Adding…" : pipelineState === "added" ? "Added to Pipeline" : "Add to Pipeline"}
                </button>
              )}
              {opp.source_url && (
                <a
                  href={opp.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1 text-[11px] text-slate-400 transition hover:text-slate-600"
                >
                  View source <ArrowUpRight className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
