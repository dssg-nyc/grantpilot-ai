"use client";

import { Plus, Trash2 } from "lucide-react";
import { OrgProfile, Program } from "@/types/profile";

interface StepProps {
  data: Partial<OrgProfile>;
  onChange: (updates: Partial<OrgProfile>) => void;
}

const GRANT_SIZE_RANGES = [
  { value: "<10k", label: "Under $10,000" },
  { value: "10k-50k", label: "$10,000 – $50,000" },
  { value: "50k-250k", label: "$50,000 – $250,000" },
  { value: "250k+", label: "$250,000+" },
];

const FUNDER_TYPES = [
  "Federal",
  "State/Local",
  "Foundation",
  "Corporate",
  "Individual",
];

export default function FundingHistoryStep({ data, onChange }: StepProps) {
  const programs: Program[] = data.programs ?? [];
  const funderTypes = data.previous_funder_types ?? [];

  function toggleFunderType(type: string) {
    if (funderTypes.includes(type)) {
      onChange({ previous_funder_types: funderTypes.filter((t) => t !== type) });
    } else {
      onChange({ previous_funder_types: [...funderTypes, type] });
    }
  }

  function addProgram() {
    onChange({ programs: [...programs, { name: "", description: "" }] });
  }

  function removeProgram(index: number) {
    onChange({ programs: programs.filter((_, i) => i !== index) });
  }

  function updateProgram(index: number, field: keyof Program, value: string | number) {
    const updated = programs.map((p, i) =>
      i === index ? { ...p, [field]: value } : p
    );
    onChange({ programs: updated });
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Funding History</h2>
        <p className="mt-1 text-sm text-slate-500">
          Tell us about your grant history and programs to improve match quality.
        </p>
      </div>

      {/* Has Received Grants */}
      <div className="space-y-2">
        <span className="block text-sm font-medium text-slate-700">
          Has your organization previously received grants?
        </span>
        <div className="flex gap-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input
              type="radio"
              name="has_received_grants"
              checked={data.has_received_grants === true}
              onChange={() => onChange({ has_received_grants: true })}
              className="h-4 w-4 accent-blue-600"
            />
            Yes
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input
              type="radio"
              name="has_received_grants"
              checked={data.has_received_grants === false}
              onChange={() => onChange({ has_received_grants: false })}
              className="h-4 w-4 accent-blue-600"
            />
            No
          </label>
        </div>
      </div>

      {/* Grant details — shown only if has received */}
      {data.has_received_grants && (
        <>
          {/* Average Grant Size */}
          <div className="space-y-2">
            <label htmlFor="avg_grant_size_range" className="block text-sm font-medium text-slate-700">
              Average Grant Size Received
            </label>
            <select
              id="avg_grant_size_range"
              value={data.avg_grant_size_range ?? ""}
              onChange={(e) => onChange({ avg_grant_size_range: e.target.value || null })}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:w-64"
            >
              <option value="" disabled>Select a range…</option>
              {GRANT_SIZE_RANGES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {/* Previous Funder Types */}
          <div className="space-y-2">
            <span className="block text-sm font-medium text-slate-700">Previous Funder Types</span>
            <div className="flex flex-wrap gap-3">
              {FUNDER_TYPES.map((type) => {
                const checked = funderTypes.includes(type);
                return (
                  <label
                    key={type}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                      checked
                        ? "border-blue-500 bg-blue-50 text-blue-800"
                        : "border-slate-200 bg-white text-slate-600 hover:border-blue-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleFunderType(type)}
                      className="h-4 w-4 rounded accent-blue-600"
                    />
                    {type}
                  </label>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Has Active Grants */}
      <div className="space-y-2">
        <span className="block text-sm font-medium text-slate-700">
          Do you currently have any active grants?
        </span>
        <div className="flex gap-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input
              type="radio"
              name="has_active_grants"
              checked={data.has_active_grants === true}
              onChange={() => onChange({ has_active_grants: true })}
              className="h-4 w-4 accent-blue-600"
            />
            Yes
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input
              type="radio"
              name="has_active_grants"
              checked={data.has_active_grants === false}
              onChange={() => onChange({ has_active_grants: false })}
              className="h-4 w-4 accent-blue-600"
            />
            No
          </label>
        </div>
      </div>

      {/* Programs */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="block text-sm font-medium text-slate-700">Programs & Initiatives</span>
            <p className="text-xs text-slate-500 mt-0.5">
              Add the key programs your organization runs.
            </p>
          </div>
          <button
            type="button"
            onClick={addProgram}
            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-300 px-3 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-50"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Program
          </button>
        </div>

        {programs.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
            No programs added yet. Click &quot;Add Program&quot; to get started.
          </div>
        )}

        <div className="space-y-3">
          {programs.map((program, index) => (
            <div
              key={index}
              className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Program {index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeProgram(index)}
                  className="rounded p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                  aria-label="Remove program"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-600">
                  Program Name
                </label>
                <input
                  type="text"
                  value={program.name}
                  onChange={(e) => updateProgram(index, "name", e.target.value)}
                  placeholder="e.g. After-School Tutoring"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-600">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={program.description}
                  onChange={(e) => updateProgram(index, "description", e.target.value)}
                  placeholder="Briefly describe what this program does and who it serves…"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
