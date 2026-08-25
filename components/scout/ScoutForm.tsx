"use client";

import { useState } from "react";
import { Radar, Loader2, Square } from "lucide-react";
import {
  SCOUT_FUNDER_TYPES,
  SCOUT_FUNDER_TYPE_LABELS,
  type ScoutFunderType,
  type ScoutRequest,
  type ScoutScope,
} from "@/types/scout";

interface ScoutFormProps {
  isRunning: boolean;
  onStart: (request: ScoutRequest) => void;
  onStop: () => void;
}

function parseMoney(value: string): number | null {
  const cleaned = value.replace(/[$,\s]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export default function ScoutForm({ isRunning, onStart, onStop }: ScoutFormProps) {
  const [scope, setScope] = useState<ScoutScope>("organization");
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [geographicFocus, setGeographicFocus] = useState("");
  const [funderTypes, setFunderTypes] = useState<ScoutFunderType[]>([]);
  const [targetCount, setTargetCount] = useState(8);
  const [validationError, setValidationError] = useState<string | null>(null);

  function toggleFunderType(type: ScoutFunderType) {
    setFunderTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (scope === "project" && !projectName.trim() && !projectDescription.trim()) {
      setValidationError("Describe the project, or switch back to funding your whole organization.");
      return;
    }
    setValidationError(null);
    onStart({
      scope,
      project_name: projectName.trim() || undefined,
      project_description: projectDescription.trim() || undefined,
      funding_need_min: parseMoney(minAmount),
      funding_need_max: parseMoney(maxAmount),
      geographic_focus: geographicFocus.trim() || undefined,
      funder_types: funderTypes,
      target_count: targetCount,
    });
  }

  const inputClass =
    "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100";

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Radar className="h-4 w-4 text-blue-600" />
        <h2 className="text-sm font-semibold text-slate-900">What should the scout look for?</h2>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {(["organization", "project"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setScope(value)}
            className={`rounded-lg border px-3 py-2.5 text-left text-sm transition ${
              scope === value
                ? "border-blue-300 bg-blue-50 text-blue-800"
                : "border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            <span className="block font-medium">
              {value === "organization" ? "My whole organization" : "A specific project"}
            </span>
            <span className="mt-0.5 block text-xs opacity-70">
              {value === "organization"
                ? "General operating, capacity, and program grants"
                : "Funders whose priorities match this initiative"}
            </span>
          </button>
        ))}
      </div>

      {scope === "project" && (
        <div className="mt-4 space-y-3">
          <div>
            <label htmlFor="scout-project-name" className="mb-1 block text-xs font-medium text-slate-600">
              Project name
            </label>
            <input
              id="scout-project-name"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g. Bronx Youth Data Literacy Lab"
              className={inputClass}
              maxLength={200}
            />
          </div>
          <div>
            <label htmlFor="scout-project-desc" className="mb-1 block text-xs font-medium text-slate-600">
              What the project does
            </label>
            <textarea
              id="scout-project-desc"
              value={projectDescription}
              onChange={(e) => setProjectDescription(e.target.value)}
              rows={4}
              maxLength={4000}
              placeholder="Who it serves, what activities it funds, roughly what it costs, and where it runs. The more concrete this is, the better the matches."
              className={`${inputClass} resize-y`}
            />
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="scout-min" className="mb-1 block text-xs font-medium text-slate-600">
            Minimum award (optional)
          </label>
          <input
            id="scout-min"
            value={minAmount}
            onChange={(e) => setMinAmount(e.target.value)}
            placeholder="$25,000"
            inputMode="numeric"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="scout-max" className="mb-1 block text-xs font-medium text-slate-600">
            Maximum award (optional)
          </label>
          <input
            id="scout-max"
            value={maxAmount}
            onChange={(e) => setMaxAmount(e.target.value)}
            placeholder="$250,000"
            inputMode="numeric"
            className={inputClass}
          />
        </div>
      </div>

      <div className="mt-3">
        <label htmlFor="scout-geo" className="mb-1 block text-xs font-medium text-slate-600">
          Geographic focus (optional)
        </label>
        <input
          id="scout-geo"
          value={geographicFocus}
          onChange={(e) => setGeographicFocus(e.target.value)}
          placeholder="e.g. New York City, or Northeast US, or nationwide"
          className={inputClass}
          maxLength={200}
        />
      </div>

      <fieldset className="mt-4">
        <legend className="mb-2 text-xs font-medium text-slate-600">
          Funder types (optional — leave empty to search all)
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {SCOUT_FUNDER_TYPES.filter((t) => t !== "other").map((type) => {
            const selected = funderTypes.includes(type);
            return (
              <button
                key={type}
                type="button"
                onClick={() => toggleFunderType(type)}
                aria-pressed={selected}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  selected
                    ? "border-blue-300 bg-blue-50 text-blue-700"
                    : "border-slate-200 text-slate-500 hover:bg-slate-50"
                }`}
              >
                {SCOUT_FUNDER_TYPE_LABELS[type]}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-4">
        <label htmlFor="scout-count" className="mb-1 block text-xs font-medium text-slate-600">
          How many opportunities to aim for: <span className="font-semibold text-slate-800">{targetCount}</span>
        </label>
        <input
          id="scout-count"
          type="range"
          min={3}
          max={15}
          value={targetCount}
          onChange={(e) => setTargetCount(Number(e.target.value))}
          className="w-full accent-blue-600"
        />
        <p className="mt-1 text-[11px] text-slate-400">
          The scout returns fewer than this when it can&apos;t honestly justify more. That&apos;s intended.
        </p>
      </div>

      {validationError && <p className="mt-3 text-xs text-red-600">{validationError}</p>}

      <div className="mt-5 flex gap-2">
        <button
          type="submit"
          disabled={isRunning}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:opacity-60"
        >
          {isRunning ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Researching…
            </>
          ) : (
            <>
              <Radar className="h-4 w-4" />
              Find funding
            </>
          )}
        </button>
        {isRunning && (
          <button
            type="button"
            onClick={onStop}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            <Square className="h-3.5 w-3.5" />
            Stop
          </button>
        )}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
        A run takes a few minutes: the agent searches the open web, opens each funder&apos;s own page, and scores fit
        against your profile. Results are saved as they&apos;re found, so you can leave and come back.
      </p>
    </form>
  );
}
