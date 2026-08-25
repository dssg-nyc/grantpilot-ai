"use client";

import { useState } from "react";
import { Radar, AlertCircle, Download, Copy, Check, Inbox } from "lucide-react";
import ScoutForm from "@/components/scout/ScoutForm";
import ActivityFeed from "@/components/scout/ActivityFeed";
import RunHistory from "@/components/scout/RunHistory";
import FindingCard from "@/components/scout/FindingCard";
import { useScoutRun, useScoutRuns, useScoutSession } from "@/hooks/useScout";
import type { ScoutFinding, ScoutRequest } from "@/types/scout";

function buildExport(findings: ScoutFinding[], summary: string) {
  return {
    generated_at: new Date().toISOString(),
    summary,
    opportunity_count: findings.length,
    opportunities: findings.map((f) => ({
      title: f.title,
      funder: f.funder_name,
      funder_type: f.funder_type,
      source_url: f.source_url,
      application_url: f.application_url,
      summary: f.program_summary,
      amount_min: f.amount_min,
      amount_max: f.amount_max,
      amount_note: f.amount_note,
      deadline: f.deadline,
      deadline_note: f.deadline_note,
      eligibility: f.eligibility_summary,
      geographic_eligibility: f.geographic_eligibility,
      focus_areas: f.focus_areas,
      fit_score: f.fit_score,
      fit_rationale: f.fit_rationale,
      concerns: f.concerns,
      evidence_confidence: f.evidence_confidence,
    })),
  };
}

export default function ScoutPage() {
  const session = useScoutSession();
  const { data: runs } = useScoutRuns();
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const activeRunId = selectedRunId ?? session.runId;
  const { data: loadedRun } = useScoutRun(activeRunId);

  // While a run streams, the live session is the freshest view. Once it ends,
  // the database copy is authoritative — it includes anything recorded after
  // the connection dropped.
  const showingLiveRun = session.isRunning && activeRunId === session.runId;
  const findings: ScoutFinding[] = showingLiveRun
    ? session.findings
    : loadedRun?.findings ?? session.findings;
  const summary = showingLiveRun ? session.summary : loadedRun?.summary ?? session.summary;
  const runError = loadedRun?.error ?? null;

  function handleStart(request: ScoutRequest) {
    setSelectedRunId(null);
    session.start(request);
  }

  function handleSelectRun(id: string) {
    setSelectedRunId(id);
    setCopied(false);
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(JSON.stringify(buildExport(findings, summary ?? ""), null, 2));
    setCopied(true);
  }

  function handleDownload() {
    const blob = new Blob([JSON.stringify(buildExport(findings, summary ?? ""), null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `funding-opportunities-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <header className="mb-6">
        <div className="flex items-center gap-2">
          <Radar className="h-5 w-5 text-blue-700" />
          <h1 className="text-xl font-bold text-slate-900">Funding Scout</h1>
        </div>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Searches the open web for funding your organization or a specific project could actually win — the
          foundations, corporate programs, and state and local grants that don&apos;t appear in any public grants
          feed. Every result links back to the funder&apos;s own page so you can verify it yourself.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <div className="space-y-4">
          <ScoutForm isRunning={session.isRunning} onStart={handleStart} onStop={session.stop} />
          <ActivityFeed activity={session.activity} isRunning={session.isRunning} />
          <RunHistory runs={runs ?? []} activeRunId={activeRunId} onSelect={handleSelectRun} />
        </div>

        <div className="space-y-4">
          {(session.error || runError) && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p className="text-sm text-amber-800">{session.error ?? runError}</p>
            </div>
          )}

          {findings.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-slate-700">
                {findings.length} opportunit{findings.length === 1 ? "y" : "ies"}
                {session.isRunning && <span className="ml-2 text-slate-400">still searching…</span>}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied" : "Copy JSON"}
                </button>
                <button
                  onClick={handleDownload}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </button>
              </div>
            </div>
          )}

          {findings.map((finding) => (
            <FindingCard key={finding.id} finding={finding} />
          ))}

          {summary && (
            <section className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <h2 className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                Scout&apos;s read on your funding landscape
              </h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{summary}</p>
            </section>
          )}

          {findings.length === 0 && !session.isRunning && !summary && (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center">
              <Inbox className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3 text-sm font-medium text-slate-700">No research run yet</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                Set the scope on the left and start a run. The scout will search the web, read each funder&apos;s own
                page, and score how well each opportunity fits your organization.
              </p>
            </div>
          )}

          {findings.length === 0 && session.isRunning && (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center">
              <Radar className="mx-auto h-8 w-8 animate-pulse text-blue-400" />
              <p className="mt-3 text-sm font-medium text-slate-700">Searching for funding…</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                Opportunities appear here as the scout verifies each one at its source. This usually takes a few
                minutes.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
