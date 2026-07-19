"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { useState } from "react";
import { FOCUS_AREA_TAXONOMY } from "@/lib/utils/taxonomy";

export interface FilterState {
  funder_type: string;
  funding_type: string;
  focus_areas: string[];
  amount_min: string;
  amount_max: string;
  geographic_scope: string;
  deadline_to: string;
}

interface OpportunityFiltersProps {
  filters: FilterState;
  onChange: (updates: Partial<FilterState>) => void;
  onReset: () => void;
}

const FUNDER_TYPES = [
  { value: "",                  label: "All" },
  { value: "federal_government", label: "Federal" },
  { value: "state_government",  label: "State" },
  { value: "foundation",        label: "Foundation" },
  { value: "corporate",         label: "Corporate" },
  { value: "international",     label: "International" },
];

const FUNDING_TYPES = [
  { value: "", label: "All" },
  { value: "grant",       label: "Grant" },
  { value: "fellowship",  label: "Fellowship" },
  { value: "award",       label: "Award" },
  { value: "contract",    label: "Contract" },
];

// Single canonical taxonomy — must match what AI extraction/classification
// and the matching engine use (see components/onboarding/steps/FocusAreasStep.tsx),
// otherwise a selected filter silently never matches any opportunity.
const FOCUS_AREAS = [...FOCUS_AREA_TAXONOMY];

const GEO_SCOPES = [
  { value: "",            label: "Any" },
  { value: "national",    label: "National" },
  { value: "multi_state", label: "Multi-state" },
  { value: "state",       label: "State" },
  { value: "regional",    label: "Regional" },
  { value: "local",       label: "Local" },
];

function FilterSection({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-2 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-600 transition"
      >
        {title}
        <span className={`text-slate-300 transition-transform ${open ? "rotate-180" : ""} text-xs`}>▲</span>
      </button>
      {open && <div className="mt-1.5 space-y-1">{children}</div>}
    </div>
  );
}

export default function OpportunityFilters({ filters, onChange, onReset }: OpportunityFiltersProps) {
  const activeCount = [
    filters.funder_type,
    filters.funding_type,
    filters.geographic_scope,
    filters.amount_min,
    filters.amount_max,
    filters.deadline_to,
    ...filters.focus_areas,
  ].filter(Boolean).length;

  function toggleFocusArea(area: string) {
    const updated = filters.focus_areas.includes(area)
      ? filters.focus_areas.filter((a) => a !== area)
      : [...filters.focus_areas, area];
    onChange({ focus_areas: updated });
  }

  return (
    <aside className="w-52 shrink-0">
      <div className="sticky top-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500" />
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Filters</span>
            {activeCount > 0 && (
              <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
                {activeCount}
              </span>
            )}
          </div>
          {activeCount > 0 && (
            <button onClick={onReset} className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-red-500 transition">
              <X className="h-3 w-3" /> Clear
            </button>
          )}
        </div>

        {/* Funder Type — chip buttons */}
        <FilterSection title="Funder Type">
          <div className="flex flex-wrap gap-1">
            {FUNDER_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => onChange({ funder_type: t.value })}
                className={`rounded-full border px-2 py-0.5 text-[11px] font-medium transition ${
                  filters.funder_type === t.value
                    ? "border-blue-500 bg-blue-600 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-600"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </FilterSection>

        {/* Funding Type — chip buttons */}
        <FilterSection title="Funding Type">
          <div className="flex flex-wrap gap-1">
            {FUNDING_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => onChange({ funding_type: t.value })}
                className={`rounded-full border px-2 py-0.5 text-[11px] font-medium transition ${
                  filters.funding_type === t.value
                    ? "border-blue-500 bg-blue-600 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-600"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </FilterSection>

        {/* Focus Areas */}
        <FilterSection title="Focus Areas">
          <div className="max-h-44 overflow-y-auto space-y-1 pr-1">
            {FOCUS_AREAS.map((area) => {
              const checked = filters.focus_areas.includes(area);
              return (
                <label key={area} className="flex cursor-pointer items-center gap-2 group">
                  <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                    checked
                      ? "border-blue-600 bg-blue-600"
                      : "border-slate-300 group-hover:border-blue-400"
                  }`}>
                    {checked && (
                      <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 12 12">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <input type="checkbox" className="sr-only" checked={checked} onChange={() => toggleFocusArea(area)} />
                  <span className={`text-xs transition ${checked ? "font-medium text-slate-800" : "text-slate-500 group-hover:text-slate-700"}`}>
                    {area}
                  </span>
                </label>
              );
            })}
          </div>
        </FilterSection>

        {/* Amount */}
        <FilterSection title="Grant Amount" defaultOpen={false}>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              placeholder="Min"
              value={filters.amount_min}
              onChange={(e) => onChange({ amount_min: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
            />
            <span className="text-slate-300 text-xs">–</span>
            <input
              type="number"
              placeholder="Max"
              value={filters.amount_max}
              onChange={(e) => onChange({ amount_max: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
            />
          </div>
        </FilterSection>

        {/* Geography */}
        <FilterSection title="Geography" defaultOpen={false}>
          <div className="flex flex-wrap gap-1">
            {GEO_SCOPES.map((s) => (
              <button
                key={s.value}
                onClick={() => onChange({ geographic_scope: s.value })}
                className={`rounded-full border px-2 py-0.5 text-[11px] font-medium transition ${
                  filters.geographic_scope === s.value
                    ? "border-blue-500 bg-blue-600 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-blue-300"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </FilterSection>

        {/* Deadline */}
        <FilterSection title="Deadline By" defaultOpen={false}>
          <input
            type="date"
            value={filters.deadline_to}
            onChange={(e) => onChange({ deadline_to: e.target.value })}
            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
          />
        </FilterSection>
      </div>
    </aside>
  );
}
