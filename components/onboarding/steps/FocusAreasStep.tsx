"use client";

import { OrgProfile } from "@/types/profile";
import { FOCUS_AREA_TAXONOMY } from "@/lib/utils/taxonomy";

interface StepProps {
  data: Partial<OrgProfile>;
  onChange: (updates: Partial<OrgProfile>) => void;
}

// Single canonical taxonomy — must match what AI extraction and the matching
// engine use, otherwise user selections silently fail to match opportunities.
const FOCUS_AREAS = [...FOCUS_AREA_TAXONOMY];

const SDG_LIST: { number: number; name: string }[] = [
  { number: 1, name: "No Poverty" },
  { number: 2, name: "Zero Hunger" },
  { number: 3, name: "Good Health & Well-being" },
  { number: 4, name: "Quality Education" },
  { number: 5, name: "Gender Equality" },
  { number: 6, name: "Clean Water & Sanitation" },
  { number: 7, name: "Affordable & Clean Energy" },
  { number: 8, name: "Decent Work & Economic Growth" },
  { number: 9, name: "Industry, Innovation & Infrastructure" },
  { number: 10, name: "Reduced Inequalities" },
  { number: 11, name: "Sustainable Cities & Communities" },
  { number: 12, name: "Responsible Consumption & Production" },
  { number: 13, name: "Climate Action" },
  { number: 14, name: "Life Below Water" },
  { number: 15, name: "Life on Land" },
  { number: 16, name: "Peace, Justice & Strong Institutions" },
  { number: 17, name: "Partnerships for the Goals" },
];

export default function FocusAreasStep({ data, onChange }: StepProps) {
  const primary = data.primary_focus_areas ?? [];
  const secondary = data.secondary_focus_areas ?? [];
  const sdgs = data.sdg_alignments ?? [];

  function togglePrimary(area: string) {
    if (primary.includes(area)) {
      onChange({ primary_focus_areas: primary.filter((a) => a !== area) });
    } else if (primary.length < 3) {
      onChange({ primary_focus_areas: [...primary, area] });
    }
  }

  function toggleSecondary(area: string) {
    if (secondary.includes(area)) {
      onChange({ secondary_focus_areas: secondary.filter((a) => a !== area) });
    } else if (!primary.includes(area)) {
      onChange({ secondary_focus_areas: [...secondary, area] });
    }
  }

  function toggleSdg(num: number) {
    if (sdgs.includes(num)) {
      onChange({ sdg_alignments: sdgs.filter((n) => n !== num) });
    } else {
      onChange({ sdg_alignments: [...sdgs, num] });
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Focus Areas</h2>
        <p className="mt-1 text-sm text-slate-500">
          Select the cause areas your organization works in.
        </p>
      </div>

      {/* Primary Focus Areas */}
      <div className="space-y-3">
        <div>
          <span className="block text-sm font-medium text-slate-700">
            Primary Focus Areas{" "}
            <span className="font-normal text-slate-400">(select up to 3)</span>
          </span>
          <p className="text-xs text-slate-500 mt-0.5">
            These are the main areas driving your grant searches.{" "}
            {primary.length}/3 selected
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {FOCUS_AREAS.map((area) => {
            const isSelected = primary.includes(area);
            const isDisabled = !isSelected && primary.length >= 3;
            return (
              <label
                key={area}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-sm transition ${
                  isSelected
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : isDisabled
                    ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300"
                    : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50/50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  disabled={isDisabled}
                  onChange={() => togglePrimary(area)}
                  className="h-4 w-4 shrink-0 rounded accent-blue-600 disabled:opacity-40"
                />
                <span className="leading-tight">{area}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Secondary Focus Areas */}
      <div className="space-y-3">
        <div>
          <span className="block text-sm font-medium text-slate-700">
            Secondary Focus Areas{" "}
            <span className="font-normal text-slate-400">(optional)</span>
          </span>
          <p className="text-xs text-slate-500 mt-0.5">
            Additional areas your org touches. Cannot overlap with primary.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {FOCUS_AREAS.map((area) => {
            const isPrimary = primary.includes(area);
            const isSelected = secondary.includes(area);
            return (
              <label
                key={area}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-sm transition ${
                  isPrimary
                    ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300"
                    : isSelected
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50/50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  disabled={isPrimary}
                  onChange={() => toggleSecondary(area)}
                  className="h-4 w-4 shrink-0 rounded accent-emerald-600 disabled:opacity-30"
                />
                <span className="leading-tight">{area}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* SDG Alignments */}
      <div className="space-y-3">
        <div>
          <span className="block text-sm font-medium text-slate-700">
            UN Sustainable Development Goal Alignments{" "}
            <span className="font-normal text-slate-400">(optional)</span>
          </span>
          <p className="text-xs text-slate-500 mt-0.5">
            Align your work with global SDGs to improve matches with aligned funders.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {SDG_LIST.map((sdg) => {
            const isSelected = sdgs.includes(sdg.number);
            return (
              <label
                key={sdg.number}
                className={`flex cursor-pointer items-center gap-2.5 rounded-lg border p-2.5 text-sm transition ${
                  isSelected
                    ? "border-amber-500 bg-amber-50 text-amber-800"
                    : "border-slate-200 bg-white text-slate-600 hover:border-amber-300 hover:bg-amber-50/50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleSdg(sdg.number)}
                  className="h-4 w-4 shrink-0 rounded accent-amber-600"
                />
                <span className="font-medium text-xs shrink-0 w-5 text-right text-slate-400">
                  {sdg.number}.
                </span>
                <span className="leading-tight">{sdg.name}</span>
              </label>
            );
          })}
        </div>
        {sdgs.length > 0 && (
          <p className="text-xs text-slate-500">{sdgs.length} SDG{sdgs.length !== 1 ? "s" : ""} selected</p>
        )}
      </div>
    </div>
  );
}
