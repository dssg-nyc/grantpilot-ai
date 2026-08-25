"use client";

import { useState } from "react";
import { Globe, Loader2, Sparkles, AlertCircle, Check } from "lucide-react";
import type { OrgProfile } from "@/types/profile";

const FIELD_LABELS: Record<string, string> = {
  legal_name: "Legal name",
  dba_name: "Also known as",
  mission_statement: "Mission",
  org_type: "Organization type",
  primary_focus_areas: "Primary focus areas",
  secondary_focus_areas: "Secondary focus areas",
  target_beneficiaries: "Who you serve",
  geographic_service_area: "Service area",
  service_states: "States",
  service_cities: "Cities",
  year_founded: "Year founded",
  years_in_operation: "Years operating",
  is_501c3: "501(c)(3) status",
  ein: "EIN",
  annual_budget_range: "Budget range",
  staff_full_time: "Full-time staff",
  staff_part_time: "Part-time staff",
  programs: "Programs",
};

interface ImportResponse {
  suggestions: Partial<OrgProfile>;
  website_url: string;
  filled_fields: string[];
  not_found: string[];
  confidence: number;
  sources: string[];
}

export default function WebsiteImport({
  onApply,
}: {
  onApply: (suggestions: Partial<OrgProfile> & { website_url?: string }) => void;
}) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResponse | null>(null);

  async function handleImport() {
    if (!url.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/profile/from-website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Couldn't read that website.");
      const data = json as ImportResponse;
      setResult(data);
      onApply({ ...data.suggestions, website_url: data.website_url });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that website.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-blue-600" />
        <h3 className="text-sm font-semibold text-slate-900">Start from your website</h3>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-slate-600">
        Paste your organization&apos;s web address and we&apos;ll read it to fill in what we can. Everything stays
        editable — check each field before you continue, since we only fill in what the site actually says.
      </p>

      <div className="mt-3 flex gap-2">
        <div className="relative flex-1">
          <Globe className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleImport();
              }
            }}
            placeholder="yourorganization.org"
            aria-label="Organization website address"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <button
          type="button"
          onClick={handleImport}
          disabled={loading || !url.trim()}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Reading…
            </>
          ) : (
            "Autofill"
          )}
        </button>
      </div>

      {loading && (
        <p className="mt-2 text-xs text-slate-500">
          Reading your homepage and about pages — this usually takes 20-40 seconds.
        </p>
      )}

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
          <p className="text-xs text-amber-800">{error}</p>
        </div>
      )}

      {result && (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <div className="flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5 text-emerald-600" />
            <p className="text-xs font-semibold text-emerald-800">
              Filled {result.filled_fields.length} field{result.filled_fields.length === 1 ? "" : "s"} from{" "}
              {result.sources.length} page{result.sources.length === 1 ? "" : "s"}
            </p>
          </div>

          {result.filled_fields.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {result.filled_fields.map((f) => (
                <span key={f} className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                  {FIELD_LABELS[f] ?? f}
                </span>
              ))}
            </div>
          )}

          {result.not_found.length > 0 && (
            <p className="mt-2 text-[11px] leading-relaxed text-slate-600">
              <span className="font-medium">Still needs you: </span>
              {result.not_found.map((f) => FIELD_LABELS[f] ?? f).join(", ")}
            </p>
          )}

          {result.confidence < 0.5 && (
            <p className="mt-2 text-[11px] text-amber-700">
              Low confidence — the site was thin on detail, so review every field carefully.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
