"use client";

import Link from "next/link";
import { ArrowRight, Sparkles, ExternalLink } from "lucide-react";
import { useMatches } from "@/hooks/useMatches";
import { useProfile } from "@/hooks/useProfile";

function ScoreRing({ score }: { score: number }) {
  const r = 16;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color =
    score >= 70 ? "#10b981" :
    score >= 50 ? "#3b82f6" :
    score >= 30 ? "#f59e0b" : "#ef4444";
  const trackColor = "#f1f5f9";

  return (
    <div className="relative flex-shrink-0" title={`${score}% match`}>
      <svg width="40" height="40" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r={r} fill="none" stroke={trackColor} strokeWidth="3.5" />
        <circle
          cx="20" cy="20" r={r} fill="none"
          stroke={color} strokeWidth="3.5"
          strokeDasharray={`${fill} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 20 20)"
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center text-[10px] font-bold"
        style={{ color }}
      >
        {score}
      </span>
    </div>
  );
}

export default function RecentMatches() {
  const { data, isLoading } = useMatches();
  const { data: profile } = useProfile();
  const hasProfile = !!profile?.organization && (profile?.profile_completeness ?? 0) >= 30;
  const matches = (data?.data ?? []).slice(0, 5) as Array<{
    match: { match_score: number; recommended_action?: string; status: string };
    opportunity: { id: string; title: string; funder_name: string; funder_type: string; source_url?: string };
  }>;

  const FUNDER_COLORS: Record<string, string> = {
    federal_government: "bg-purple-50 text-purple-700",
    foundation:         "bg-blue-50 text-blue-700",
    corporate:          "bg-emerald-50 text-emerald-700",
    state_government:   "bg-orange-50 text-orange-700",
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50">
            <Sparkles className="h-3.5 w-3.5 text-blue-500" />
          </div>
          <h2 className="text-sm font-semibold text-slate-900">Top Matches</h2>
        </div>
        <Link
          href="/dashboard/matches"
          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-blue-600 transition hover:bg-blue-50"
        >
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Loading skeletons */}
      {isLoading && (
        <div className="divide-y divide-slate-50 px-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-4">
              <div className="h-10 w-10 rounded-full bg-slate-100 animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-3/5 rounded bg-slate-100 animate-pulse" />
                <div className="h-2.5 w-2/5 rounded bg-slate-100 animate-pulse" />
              </div>
              <div className="h-5 w-14 rounded-full bg-slate-100 animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && matches.length === 0 && (
        <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
            <Sparkles className="h-5 w-5 text-slate-400" />
          </div>
          <p className="mt-3 text-sm font-medium text-slate-600">No matches yet</p>
          <p className="mt-1 text-xs text-slate-400">
            {hasProfile
              ? "We're scoring grants against your profile — check back soon."
              : "Complete your profile to get AI-matched grants"}
          </p>
          <Link
            href={hasProfile ? "/dashboard/opportunities" : "/onboarding"}
            className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
          >
            {hasProfile ? "Browse opportunities" : "Complete Profile"}
          </Link>
        </div>
      )}

      {/* Match rows */}
      {!isLoading && matches.length > 0 && (
        <ul className="divide-y divide-slate-50">
          {matches.map(({ match, opportunity }) => {
            const badgeClass = FUNDER_COLORS[opportunity.funder_type] ?? "bg-slate-100 text-slate-600";
            const funderLabel = opportunity.funder_type
              .replace(/_/g, " ")
              .replace(/\b\w/g, (c) => c.toUpperCase());
            return (
              <li key={opportunity.id} className="group flex items-center gap-4 px-6 py-3.5 transition hover:bg-slate-50">
                <ScoreRing score={match.match_score} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900 group-hover:text-blue-600 transition">
                    {opportunity.title}
                  </p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <p className="text-xs text-slate-500">{opportunity.funder_name}</p>
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${badgeClass}`}>
                      {funderLabel}
                    </span>
                  </div>
                </div>
                {opportunity.source_url && (
                  <a
                    href={opportunity.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0 rounded-md p-1 text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-blue-500"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
