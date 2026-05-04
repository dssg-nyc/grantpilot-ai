"use client";

import Link from "next/link";
import { Sparkles, TrendingUp, Clock, ClipboardList, ArrowUpRight } from "lucide-react";
import { useMatches } from "@/hooks/useMatches";
import { usePipeline } from "@/hooks/usePipeline";

const CARDS = [
  {
    key: "total" as const,
    label: "Total Matches",
    sub: "All AI-curated grants",
    icon: Sparkles,
    iconColor: "text-blue-500",
    iconBg: "bg-blue-50",
    border: "border-blue-100",
    href: "/dashboard/matches",
  },
  {
    key: "strong" as const,
    label: "Strong Matches",
    sub: "Score ≥ 70%",
    icon: TrendingUp,
    iconColor: "text-emerald-500",
    iconBg: "bg-emerald-50",
    border: "border-emerald-100",
    href: "/dashboard/matches",
  },
  {
    key: "new" as const,
    label: "New Today",
    sub: "Since yesterday",
    icon: Clock,
    iconColor: "text-violet-500",
    iconBg: "bg-violet-50",
    border: "border-violet-100",
    href: "/dashboard/matches",
  },
  {
    key: "pipeline" as const,
    label: "In Pipeline",
    sub: "Active applications",
    icon: ClipboardList,
    iconColor: "text-amber-500",
    iconBg: "bg-amber-50",
    border: "border-amber-100",
    href: "/dashboard/pipeline",
  },
];

export default function StatsCards() {
  const { data: matchData, isLoading: matchLoading } = useMatches();
  const { data: pipelineData, isLoading: pipelineLoading } = usePipeline();

  const stats = matchData?.stats;
  const pipelineCount = Array.isArray(pipelineData) ? pipelineData.length : 0;

  const values: Record<string, number | string> = {
    total:    matchLoading    ? "—" : (stats?.total_matches       ?? 0),
    strong:   matchLoading    ? "—" : (stats?.strong_matches      ?? 0),
    new:      matchLoading    ? "—" : (stats?.new_since_last_visit ?? 0),
    pipeline: pipelineLoading ? "—" : pipelineCount,
  };
  const loading = (key: string) =>
    key === "pipeline" ? pipelineLoading : matchLoading;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {CARDS.map(({ key, label, sub, icon: Icon, iconColor, iconBg, border, href }) => (
        <Link
          key={key}
          href={href}
          className={`group relative flex flex-col gap-3 rounded-xl border bg-white p-5 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 ${border}`}
        >
          <div className="flex items-start justify-between">
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconBg}`}>
              <Icon className={`h-4 w-4 ${iconColor}`} />
            </div>
            <ArrowUpRight className="h-3.5 w-3.5 text-slate-300 transition group-hover:text-slate-400" />
          </div>

          {loading(key) ? (
            <div className="h-8 w-12 rounded-lg bg-slate-100 animate-pulse" />
          ) : (
            <p className="text-[28px] font-bold tracking-tight text-slate-900 leading-none">
              {values[key]}
            </p>
          )}

          <div>
            <p className="text-sm font-semibold text-slate-700">{label}</p>
            <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
