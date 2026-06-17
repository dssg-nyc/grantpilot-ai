"use client";

import { Calendar, DollarSign, Globe, ArrowUpRight, Building2, Landmark, Briefcase, MapPin } from "lucide-react";
import type { Opportunity } from "@/types/opportunity";

interface OpportunityCardProps {
  opportunity: Opportunity;
  onClick?: () => void;
  matchScore?: number;
}

function formatAmount(min?: number | null, max?: number | null): string | null {
  if (!min && !max) return null;
  const fmt = (n: number) =>
    n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000   ? `$${(n / 1_000).toFixed(0)}K`
    : `$${n.toLocaleString()}`;
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (max)  return `Up to ${fmt(max)}`;
  return `From ${fmt(min!)}`;
}

function postedInfo(posted?: string | null) {
  if (!posted) return null;
  const d = new Date(posted);
  if (isNaN(d.getTime())) return null;
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return { label: "New today", fresh: true };
  if (days === 1) return { label: "Posted yesterday", fresh: true };
  if (days <= 7) return { label: `Posted ${days}d ago`, fresh: false };
  return { label: `Posted ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`, fresh: false };
}

function deadlineInfo(deadline?: string | null, rolling?: boolean) {
  if (rolling) return { label: "Rolling", urgent: false, warning: false };
  if (!deadline) return null;
  const diff = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86_400_000);
  if (diff < 0) return null;
  if (diff === 0) return { label: "Due today",   urgent: true,  warning: false };
  if (diff <= 7)  return { label: `${diff}d left`, urgent: true,  warning: false };
  if (diff <= 21) return { label: `${diff}d left`, urgent: false, warning: true  };
  return {
    label: new Date(deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    urgent: false,
    warning: false,
  };
}

const FUNDER_META: Record<string, { label: string; icon: React.ElementType; badge: string }> = {
  federal_government: { label: "Federal",    icon: Landmark,   badge: "bg-purple-50 text-purple-700 border-purple-100" },
  foundation:         { label: "Foundation", icon: Building2,  badge: "bg-blue-50   text-blue-700   border-blue-100"   },
  corporate:          { label: "Corporate",  icon: Briefcase,  badge: "bg-emerald-50 text-emerald-700 border-emerald-100" },
  state_government:   { label: "State",      icon: MapPin,     badge: "bg-orange-50 text-orange-700 border-orange-100" },
  local_government:   { label: "Local",      icon: MapPin,     badge: "bg-amber-50  text-amber-700  border-amber-100"  },
};

export default function OpportunityCard({ opportunity: opp, onClick, matchScore }: OpportunityCardProps) {
  const amount = formatAmount(opp.amount_min, opp.amount_max);
  const dl = deadlineInfo(opp.deadline, opp.is_rolling_deadline);
  const posted = postedInfo(opp.posted_date);
  const meta = FUNDER_META[opp.funder_type] ?? { label: opp.funder_type, icon: Building2, badge: "bg-slate-100 text-slate-600 border-slate-200" };
  const FunderIcon = meta.icon;

  return (
    <article
      onClick={onClick}
      className="group relative flex flex-col gap-0 rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 hover:border-blue-200 cursor-pointer overflow-hidden"
    >
      {/* Top strip */}
      <div className="flex items-start gap-3 p-4 pb-3">
        {/* Funder icon */}
        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${meta.badge}`}>
          <FunderIcon className="h-3.5 w-3.5" />
        </div>

        <div className="min-w-0 flex-1">
          {/* Badge row */}
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.badge}`}>
              {meta.label}
            </span>
            {posted && (
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                posted.fresh ? "bg-green-50 text-green-700 border-green-100" : "bg-slate-50 text-slate-500 border-slate-200"
              }`}>
                {posted.label}
              </span>
            )}
            {dl && (
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                dl.urgent  ? "bg-red-50    text-red-600    border-red-100"   :
                dl.warning ? "bg-amber-50  text-amber-600  border-amber-100" :
                             "bg-slate-100 text-slate-500   border-slate-200"
              }`}>
                {dl.label}
              </span>
            )}
            {matchScore !== undefined && (
              <span className={`ml-auto rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                matchScore >= 70 ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                matchScore >= 50 ? "bg-blue-50    text-blue-700    border-blue-100"    :
                                   "bg-slate-100  text-slate-600   border-slate-200"
              }`}>
                {matchScore}% match
              </span>
            )}
          </div>

          <h3 className="text-sm font-semibold leading-snug text-slate-900 group-hover:text-blue-700 transition line-clamp-2">
            {opp.title}
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">{opp.funder_name}</p>
        </div>

        <ArrowUpRight className="h-3.5 w-3.5 shrink-0 mt-0.5 text-slate-200 transition group-hover:text-blue-400" />
      </div>

      {/* AI summary */}
      {opp.ai_summary && (
        <p className="px-4 pb-3 text-xs leading-relaxed text-slate-500 line-clamp-2">
          {opp.ai_summary}
        </p>
      )}

      {/* Footer metadata */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-100 bg-slate-50/70 px-4 py-2.5 text-[11px] text-slate-400">
        {amount && (
          <span className="flex items-center gap-1 font-medium text-slate-600">
            <DollarSign className="h-3 w-3" /> {amount}
          </span>
        )}
        {opp.geographic_scope && (
          <span className="flex items-center gap-1 capitalize">
            <Globe className="h-3 w-3" /> {opp.geographic_scope.replace(/_/g, " ")}
          </span>
        )}
        {opp.deadline && !opp.is_rolling_deadline && (
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {new Date(opp.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </span>
        )}

        {/* Focus areas */}
        {opp.focus_areas?.length > 0 && (
          <span className="ml-auto flex items-center gap-1">
            {opp.focus_areas.slice(0, 2).map((area) => (
              <span key={area} className="rounded-full bg-white border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-500">
                {area}
              </span>
            ))}
            {opp.focus_areas.length > 2 && (
              <span className="text-slate-400">+{opp.focus_areas.length - 2}</span>
            )}
          </span>
        )}
      </div>
    </article>
  );
}
