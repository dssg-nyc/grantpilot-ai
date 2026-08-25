"use client";

import { Globe, FileSearch, Database, Radar, AlertCircle, Loader2 } from "lucide-react";
import type { ScoutActivity } from "@/hooks/useScout";

const ICONS: Record<string, React.ElementType> = {
  "Searching the web": Globe,
  "Reading funder page": FileSearch,
  "Checking grants already in your database": Database,
  "Starting research run": Radar,
  "Web search failed": AlertCircle,
  "Couldn't read that page": AlertCircle,
};

function shorten(detail: string): string {
  try {
    const url = new URL(detail);
    return url.hostname.replace(/^www\./, "") + (url.pathname.length > 1 ? url.pathname : "");
  } catch {
    return detail;
  }
}

export default function ActivityFeed({
  activity,
  isRunning,
}: {
  activity: ScoutActivity[];
  isRunning: boolean;
}) {
  if (activity.length === 0) return null;

  // Newest first — during a long run the user cares about what's happening now.
  const recent = [...activity].reverse().slice(0, 12);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        {isRunning ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
        ) : (
          <Radar className="h-3.5 w-3.5 text-slate-400" />
        )}
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
          {isRunning ? "Researching" : "Research log"}
        </p>
      </div>
      <ul className="mt-3 space-y-2">
        {recent.map((item, i) => {
          const Icon = ICONS[item.label] ?? Radar;
          const isError = item.label.includes("failed") || item.label.includes("Couldn't");
          return (
            <li key={`${item.at}-${i}`} className="flex items-start gap-2 text-xs">
              <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${isError ? "text-amber-500" : "text-slate-400"}`} />
              <span className="min-w-0">
                <span className={isError ? "text-amber-700" : "text-slate-600"}>{item.label}</span>
                {item.detail && item.label !== "Starting research run" && (
                  <span className="ml-1 truncate text-slate-400">— {shorten(item.detail)}</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
