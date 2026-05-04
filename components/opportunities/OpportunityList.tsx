"use client";

import { useState } from "react";
import { useOpportunities } from "@/hooks/useOpportunities";
import { useSearch } from "@/hooks/useSearch";
import OpportunityCard from "@/components/opportunities/OpportunityCard";
import OpportunityFilters, { type FilterState } from "@/components/opportunities/OpportunityFilters";
import OpportunityDetail from "@/components/opportunities/OpportunityDetail";
import FeedTabs, { type FeedTab } from "@/components/opportunities/FeedTabs";
import SearchBar from "@/components/opportunities/SearchBar";
import type { Opportunity } from "@/types/opportunity";

const DEFAULT_FILTERS: FilterState = {
  funder_type: "",
  funding_type: "",
  focus_areas: [],
  amount_min: "",
  amount_max: "",
  geographic_scope: "",
  deadline_to: "",
};

const TAB_SORT: Record<FeedTab, string> = {
  matches: "trending",
  trending: "trending",
  closing_soon: "deadline",
  new: "newest",
  browse: "newest",
};

const TAB_STATUS: Record<FeedTab, string> = {
  matches: "active",
  trending: "active",
  closing_soon: "closing_soon",
  new: "active",
  browse: "",
};

export default function OpportunityList() {
  const [activeTab, setActiveTab] = useState<FeedTab>("browse");
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: searchData } = useSearch(searchQuery);
  const { data: oppData, isLoading } = useOpportunities({
    status: TAB_STATUS[activeTab] || undefined,
    sort: TAB_SORT[activeTab],
    funder_type: filters.funder_type || undefined,
    funding_type: filters.funding_type || undefined,
    focus_areas: filters.focus_areas.length ? filters.focus_areas : undefined,
    amount_min: filters.amount_min ? Number(filters.amount_min) : undefined,
    amount_max: filters.amount_max ? Number(filters.amount_max) : undefined,
    geographic_scope: filters.geographic_scope || undefined,
    deadline_to: filters.deadline_to || undefined,
  });

  const opportunities: Opportunity[] = searchQuery
    ? (searchData?.results ?? [])
    : (oppData?.data ?? []);

  const total = oppData?.pagination?.total ?? opportunities.length;

  return (
    <div className="space-y-4 max-w-7xl">
      {/* Search bar */}
      <SearchBar value={searchQuery} onChange={setSearchQuery} />

      {/* Tabs */}
      <FeedTabs active={activeTab} onChange={setActiveTab} />

      <div className="flex gap-5 items-start">
        {/* Filters sidebar */}
        <OpportunityFilters
          filters={filters}
          onChange={(updates) => setFilters((f) => ({ ...f, ...updates }))}
          onReset={() => setFilters(DEFAULT_FILTERS)}
        />

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Result count */}
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              {isLoading ? "Loading…" : (
                <>
                  <span className="font-semibold text-slate-700">{total.toLocaleString()}</span>{" "}
                  {total === 1 ? "opportunity" : "opportunities"}
                  {searchQuery && <span className="text-blue-600"> for &ldquo;{searchQuery}&rdquo;</span>}
                </>
              )}
            </p>
          </div>

          {/* Loading skeletons */}
          {isLoading && (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-36 animate-pulse rounded-xl border border-slate-100 bg-white" />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!isLoading && opportunities.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white py-20 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-600">No opportunities found</p>
              <p className="mt-1 text-xs text-slate-400">Try adjusting your filters or search terms</p>
            </div>
          )}

          {/* Cards */}
          {!isLoading && opportunities.length > 0 && (
            <div className="space-y-3">
              {opportunities.map((opp) => (
                <OpportunityCard
                  key={opp.id}
                  opportunity={opp}
                  onClick={() => setSelectedId(opp.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      <OpportunityDetail
        id={selectedId}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}
