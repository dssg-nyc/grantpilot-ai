"use client";

import { useState } from "react";
import { Sparkles, X, Loader2 } from "lucide-react";
import { OrgProfile } from "@/types/profile";

interface StepProps {
  data: Partial<OrgProfile>;
  onChange: (updates: Partial<OrgProfile>) => void;
}

const BENEFICIARY_OPTIONS = [
  "Children",
  "Youth",
  "Adults",
  "Elderly",
  "Women",
  "LGBTQ+",
  "Veterans",
  "Immigrants",
  "Low-income",
  "Rural communities",
  "Urban communities",
  "People with disabilities",
  "Indigenous communities",
];

interface AiPreview {
  focus_areas?: string[];
  beneficiaries?: string[];
  geo?: string;
}

export default function MissionStep({ data, onChange }: StepProps) {
  const [extracting, setExtracting] = useState(false);
  const [aiPreview, setAiPreview] = useState<AiPreview | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);

  const missionText = data.mission_statement ?? "";
  const charsLeft = 500 - missionText.length;

  async function handleExtract() {
    if (!missionText.trim()) return;
    setExtracting(true);
    setExtractError(null);
    setAiPreview(null);
    try {
      const res = await fetch("/api/profile/ai-extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mission_statement: missionText }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const json = await res.json();
      // API returns { suggestions: { primary_focus_areas, target_beneficiaries, ... }, confidence }
      const suggestions = json.suggestions ?? json;
      setAiPreview({
        focus_areas: suggestions.primary_focus_areas ?? [],
        beneficiaries: suggestions.target_beneficiaries ?? [],
        geo: suggestions.geographic_service_area,
      });
      const updates: Partial<OrgProfile> = {};
      if (suggestions.target_beneficiaries?.length) {
        const current = data.target_beneficiaries ?? [];
        updates.target_beneficiaries = Array.from(new Set([...current, ...suggestions.target_beneficiaries]));
      }
      if (suggestions.geographic_service_area) updates.geographic_service_area = suggestions.geographic_service_area;
      if (suggestions.service_states?.length) updates.service_states = suggestions.service_states;
      if (Object.keys(updates).length) onChange(updates);
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : "Extraction failed. Please try again.");
    } finally {
      setExtracting(false);
    }
  }

  function toggleBeneficiary(val: string) {
    const current = data.target_beneficiaries ?? [];
    if (current.includes(val)) {
      onChange({ target_beneficiaries: current.filter((b) => b !== val) });
    } else {
      onChange({ target_beneficiaries: [...current, val] });
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Mission & Beneficiaries</h2>
        <p className="mt-1 text-sm text-slate-500">
          Describe your organization's purpose and who you serve.
        </p>
      </div>

      {/* Mission Statement */}
      <div className="space-y-1">
        <label htmlFor="mission_statement" className="block text-sm font-medium text-slate-700">
          Mission Statement
        </label>
        <textarea
          id="mission_statement"
          rows={5}
          maxLength={500}
          value={missionText}
          onChange={(e) => onChange({ mission_statement: e.target.value })}
          placeholder="Describe your organization's mission, vision, and core purpose…"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y min-h-[120px]"
        />
        <div className="flex items-center justify-between">
          <span className={`text-xs ${charsLeft < 50 ? "text-amber-600" : "text-slate-400"}`}>
            {charsLeft} characters remaining
          </span>
          <button
            type="button"
            onClick={handleExtract}
            disabled={extracting || missionText.trim().length < 20}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {extracting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {extracting ? "Extracting…" : "Extract with AI"}
          </button>
        </div>
      </div>

      {/* AI Extract Error */}
      {extractError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {extractError}
        </div>
      )}

      {/* AI Preview */}
      {aiPreview && (
        <div className="rounded-lg border border-violet-200 bg-violet-50 p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
            AI-Extracted Insights
          </p>
          {aiPreview.focus_areas && aiPreview.focus_areas.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-violet-600">Detected Focus Areas</p>
              <div className="flex flex-wrap gap-1.5">
                {aiPreview.focus_areas.map((area) => (
                  <span
                    key={area}
                    className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-800"
                  >
                    {area}
                  </span>
                ))}
              </div>
            </div>
          )}
          {aiPreview.beneficiaries && aiPreview.beneficiaries.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-violet-600">Detected Beneficiaries</p>
              <div className="flex flex-wrap gap-1.5">
                {aiPreview.beneficiaries.map((b) => (
                  <span
                    key={b}
                    className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800"
                  >
                    {b}
                  </span>
                ))}
              </div>
            </div>
          )}
          <p className="text-xs text-violet-500">
            These have been applied below. Review and adjust as needed.
          </p>
        </div>
      )}

      {/* Target Beneficiaries */}
      <div className="space-y-2">
        <span className="block text-sm font-medium text-slate-700">Target Beneficiaries</span>
        <p className="text-xs text-slate-500">Select all populations your organization serves.</p>
        <div className="flex flex-wrap gap-2">
          {BENEFICIARY_OPTIONS.map((b) => {
            const selected = (data.target_beneficiaries ?? []).includes(b);
            return (
              <button
                key={b}
                type="button"
                onClick={() => toggleBeneficiary(b)}
                className={`rounded-full border px-3 py-1 text-sm font-medium transition ${
                  selected
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:border-blue-400 hover:text-blue-600"
                }`}
              >
                {selected && (
                  <X className="mr-1 inline h-3 w-3" />
                )}
                {b}
              </button>
            );
          })}
        </div>
        {(data.target_beneficiaries ?? []).length > 0 && (
          <p className="text-xs text-slate-500">
            {(data.target_beneficiaries ?? []).length} selected
          </p>
        )}
      </div>
    </div>
  );
}
