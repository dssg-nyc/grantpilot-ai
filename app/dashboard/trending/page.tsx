"use client";

import { useOpportunities } from "@/hooks/useOpportunities";
import OpportunityCard from "@/components/opportunities/OpportunityCard";
import { TrendingUp, Flame } from "lucide-react";
import type { Opportunity } from "@/types/opportunity";

export default function TrendingPage() {
  const { data, isLoading } = useOpportunities({ sort: "trending", limit: 20 });
  const opportunities = (data?.data ?? []) as Opportunity[];

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900">Trending Opportunities</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Most-viewed and recently-added funding opportunities across all sources
        </p>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-xl border border-slate-100 bg-white" />
          ))}
        </div>
      )}

      {/* List */}
      {!isLoading && opportunities.length > 0 && (
        <div className="space-y-3">
          {opportunities.map((opp, i) => (
            <div key={opp.id} className="relative">
              {/* Rank badge for top 3 */}
              {i < 3 && (
                <div className={`absolute -left-3 -top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black text-white shadow-sm ${
                  i === 0 ? "bg-amber-500" : i === 1 ? "bg-slate-400" : "bg-amber-700"
                }`}>
                  {i + 1}
                </div>
              )}
              <OpportunityCard opportunity={opp} />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && opportunities.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
            <TrendingUp className="h-5 w-5 text-slate-400" />
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-600">No trending data yet</p>
          <p className="mt-1 text-xs text-slate-400">New opportunities are synced every 4 hours</p>
        </div>
      )}
    </div>
  );
}
