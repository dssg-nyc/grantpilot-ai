"use client";

import { useState } from "react";
import {
  ExternalLink,
  Calendar,
  DollarSign,
  MapPin,
  AlertTriangle,
  ShieldCheck,
  Loader2,
  Check,
  Plus,
  Database,
} from "lucide-react";
import { SCOUT_FUNDER_TYPE_LABELS, type ScoutFinding, type ScoutFunderType } from "@/types/scout";
import { useImportFinding } from "@/hooks/useScout";

function formatAmount(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  const fmt = (n: number) =>
    n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000 ? `$${(n / 1_000).toFixed(0)}K`
    : `$${n.toLocaleString()}`;
  if (min != null && max != null) return min === max ? fmt(min) : `${fmt(min)} – ${fmt(max)}`;
  if (max != null) return `Up to ${fmt(max)}`;
  return `From ${fmt(min!)}`;
}

function deadlineLabel(deadline: string | null, note: string | null) {
  if (deadline) {
    const diff = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86_400_000);
    const date = new Date(deadline).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    if (diff < 0) return { label: `Closed ${date}`, urgent: false, stale: true };
    if (diff <= 14) return { label: `${date} · ${diff}d left`, urgent: true, stale: false };
    return { label: date, urgent: false, stale: false };
  }
  if (note) return { label: note, urgent: false, stale: false };
  return null;
}

function scoreTone(score: number): string {
  if (score >= 75) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (score >= 50) return "bg-blue-50 text-blue-700 border-blue-200";
  if (score >= 30) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-slate-50 text-slate-600 border-slate-200";
}

const CONFIDENCE_COPY: Record<string, { label: string; tone: string }> = {
  high: { label: "Verified at source", tone: "text-emerald-700" },
  medium: { label: "Some details unconfirmed", tone: "text-amber-700" },
  low: { label: "Unverified — check the source", tone: "text-red-700" },
};

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export default function FindingCard({ finding }: { finding: ScoutFinding }) {
  const importFinding = useImportFinding();
  const [imported, setImported] = useState(!!finding.imported_opportunity_id);
  const [importError, setImportError] = useState<string | null>(null);

  const amount = formatAmount(finding.amount_min, finding.amount_max);
  const dl = deadlineLabel(finding.deadline, finding.deadline_note);
  const confidence = CONFIDENCE_COPY[finding.evidence_confidence] ?? CONFIDENCE_COPY.medium;
  const funderLabel = SCOUT_FUNDER_TYPE_LABELS[finding.funder_type as ScoutFunderType] ?? "Other";

  function handleImport() {
    setImportError(null);
    importFinding.mutate(finding.id, {
      onSuccess: () => setImported(true),
      onError: (err) => setImportError(err instanceof Error ? err.message : "Import failed."),
    });
  }

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-base font-semibold leading-snug text-slate-900">{finding.title}</h3>
          <p className="mt-1 text-sm text-slate-500">
            {finding.funder_name}
            <span className="mx-1.5 text-slate-300">·</span>
            <span className="text-slate-400">{funderLabel}</span>
          </p>
        </div>
        <div
          className={`shrink-0 rounded-lg border px-3 py-1.5 text-center ${scoreTone(finding.fit_score)}`}
          title="How well this fits your organization, scored by the research agent"
        >
          <p className="text-lg font-bold leading-none">{finding.fit_score}</p>
          <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide opacity-75">fit</p>
        </div>
      </div>

      {finding.program_summary && (
        <p className="mt-3 text-sm leading-relaxed text-slate-600">{finding.program_summary}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500">
        {amount && (
          <span className="inline-flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5 text-slate-400" />
            {amount}
            {finding.amount_note && <span className="text-slate-400">({finding.amount_note})</span>}
          </span>
        )}
        {dl && (
          <span
            className={`inline-flex items-center gap-1.5 ${
              dl.urgent ? "font-medium text-red-600" : dl.stale ? "text-slate-400 line-through" : ""
            }`}
          >
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            {dl.label}
          </span>
        )}
        {finding.geographic_eligibility && (
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-slate-400" />
            {finding.geographic_eligibility}
          </span>
        )}
        <span className={`inline-flex items-center gap-1.5 ${confidence.tone}`}>
          <ShieldCheck className="h-3.5 w-3.5" />
          {confidence.label}
        </span>
        {finding.already_in_database && (
          <span className="inline-flex items-center gap-1.5 text-slate-500">
            <Database className="h-3.5 w-3.5 text-slate-400" />
            Already in your dashboard
          </span>
        )}
      </div>

      {finding.fit_rationale && (
        <div className="mt-4 rounded-lg bg-slate-50 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Why this fits</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-700">{finding.fit_rationale}</p>
        </div>
      )}

      {finding.eligibility_summary && (
        <p className="mt-3 text-sm text-slate-600">
          <span className="font-medium text-slate-700">Eligibility: </span>
          {finding.eligibility_summary}
        </p>
      )}

      {finding.concerns.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {finding.concerns.map((concern, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
              <span>{concern}</span>
            </li>
          ))}
        </ul>
      )}

      {finding.focus_areas.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {finding.focus_areas.map((area) => (
            <span key={area} className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-medium text-blue-700">
              {area}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
        <a
          href={finding.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
        >
          Open source page
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
        {finding.application_url && finding.application_url !== finding.source_url && (
          <a
            href={finding.application_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Apply
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}

        {imported ? (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
            <Check className="h-3.5 w-3.5" />
            In your pipeline
          </span>
        ) : (
          <button
            onClick={handleImport}
            disabled={importFinding.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100 disabled:opacity-60"
          >
            {importFinding.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Importing…
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" />
                Add to pipeline
              </>
            )}
          </button>
        )}

        <span className="ml-auto text-[11px] text-slate-400">{hostOf(finding.source_url)}</span>
      </div>

      {importError && <p className="mt-2 text-xs text-red-600">{importError}</p>}
    </article>
  );
}
