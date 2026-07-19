"use client";

import { OrgProfile } from "@/types/profile";

interface StepProps {
  data: Partial<OrgProfile>;
  onChange: (updates: Partial<OrgProfile>) => void;
}

const BUDGET_RANGES: { value: OrgProfile["annual_budget_range"]; label: string }[] = [
  { value: "<50k", label: "Under $50,000" },
  { value: "50k_250k", label: "$50,000 – $250,000" },
  { value: "250k_1m", label: "$250,000 – $1,000,000" },
  { value: "1m_5m", label: "$1,000,000 – $5,000,000" },
  { value: "5m_plus", label: "$5,000,000+" },
];

const GEO_OPTIONS: { value: OrgProfile["geographic_service_area"]; label: string; description: string }[] = [
  { value: "national", label: "National", description: "Serve the entire United States" },
  { value: "multi_state", label: "Multi-State", description: "Serve multiple states" },
  { value: "state", label: "State", description: "Serve one state" },
  { value: "regional", label: "Regional", description: "Serve a region within a state" },
  { value: "local", label: "Local", description: "Serve a city or county" },
];

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL",
  "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME",
  "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH",
  "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI",
  "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
];

export default function OperationalStep({ data, onChange }: StepProps) {
  const serviceStates = data.service_states ?? [];
  const showStateSelector = data.geographic_service_area && data.geographic_service_area !== "national";

  function toggleState(state: string) {
    if (serviceStates.includes(state)) {
      onChange({ service_states: serviceStates.filter((s) => s !== state) });
    } else {
      onChange({ service_states: [...serviceStates, state] });
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Operations & Capacity</h2>
        <p className="mt-1 text-sm text-slate-500">
          Help us understand your organization&apos;s size and geographic reach.
        </p>
      </div>

      {/* Annual Budget Range */}
      <div className="space-y-3">
        <span className="block text-sm font-medium text-slate-700">Annual Budget Range</span>
        <div className="space-y-2">
          {BUDGET_RANGES.map((range) => (
            <label
              key={range.value}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition ${
                data.annual_budget_range === range.value
                  ? "border-blue-500 bg-blue-50 text-blue-800"
                  : "border-slate-200 bg-white text-slate-600 hover:border-blue-300"
              }`}
            >
              <input
                type="radio"
                name="annual_budget_range"
                checked={data.annual_budget_range === range.value}
                onChange={() => onChange({ annual_budget_range: range.value })}
                className="h-4 w-4 accent-blue-600"
              />
              {range.label}
            </label>
          ))}
        </div>
      </div>

      {/* Staff Counts */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1">
          <label htmlFor="years_in_operation" className="block text-sm font-medium text-slate-700">
            Years in Operation
          </label>
          <input
            id="years_in_operation"
            type="number"
            min={0}
            max={200}
            value={data.years_in_operation ?? ""}
            onChange={(e) =>
              onChange({ years_in_operation: e.target.value ? parseInt(e.target.value, 10) : undefined })
            }
            placeholder="e.g. 5"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="staff_full_time" className="block text-sm font-medium text-slate-700">
            Full-Time Staff
          </label>
          <input
            id="staff_full_time"
            type="number"
            min={0}
            value={data.staff_full_time ?? ""}
            onChange={(e) =>
              onChange({ staff_full_time: e.target.value ? parseInt(e.target.value, 10) : undefined })
            }
            placeholder="0"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="staff_part_time" className="block text-sm font-medium text-slate-700">
            Part-Time Staff
          </label>
          <input
            id="staff_part_time"
            type="number"
            min={0}
            value={data.staff_part_time ?? ""}
            onChange={(e) =>
              onChange({ staff_part_time: e.target.value ? parseInt(e.target.value, 10) : undefined })
            }
            placeholder="0"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Geographic Service Area */}
      <div className="space-y-3">
        <span className="block text-sm font-medium text-slate-700">Geographic Service Area</span>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {GEO_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                data.geographic_service_area === opt.value
                  ? "border-blue-500 bg-blue-50"
                  : "border-slate-200 bg-white hover:border-blue-300"
              }`}
            >
              <input
                type="radio"
                name="geographic_service_area"
                checked={data.geographic_service_area === opt.value}
                onChange={() => {
                  onChange({
                    geographic_service_area: opt.value,
                    service_states: opt.value === "national" ? [] : data.service_states ?? [],
                  });
                }}
                className="mt-0.5 h-4 w-4 accent-blue-600"
              />
              <div>
                <p className="text-sm font-medium text-slate-900">{opt.label}</p>
                <p className="text-xs text-slate-500">{opt.description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* State Multi-Select */}
      {showStateSelector && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="block text-sm font-medium text-slate-700">
              States Served
            </span>
            <span className="text-xs text-slate-500">{serviceStates.length} selected</span>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="flex flex-wrap gap-1.5">
              {US_STATES.map((state) => {
                const isSelected = serviceStates.includes(state);
                return (
                  <button
                    key={state}
                    type="button"
                    onClick={() => toggleState(state)}
                    className={`rounded px-2 py-1 text-xs font-medium transition ${
                      isSelected
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 text-slate-500 hover:bg-blue-50 hover:text-blue-700"
                    }`}
                  >
                    {state}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
