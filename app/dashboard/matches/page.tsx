"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMatches, useUpdateMatchStatus } from "@/hooks/useMatches";
import { useAddToPipeline, usePipeline } from "@/hooks/usePipeline";
import { useProfile } from "@/hooks/useProfile";
import {
  ExternalLink, Bookmark, Plus, Check, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, Lightbulb, DollarSign, Calendar,
  Sparkles, TrendingUp, Clock, Loader2, Zap, X,
} from "lucide-react";

// ─── Score Ring ───────────────────────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const r = 20;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color =
    score >= 70 ? "#10b981" :
    score >= 50 ? "#3b82f6" :
    score >= 30 ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative shrink-0">
      <svg width="50" height="50" viewBox="0 0 50 50">
        <circle cx="25" cy="25" r={r} fill="none" stroke="#f1f5f9" strokeWidth="4" />
        <circle
          cx="25" cy="25" r={r} fill="none"
          stroke={color} strokeWidth="4"
          strokeDasharray={`${fill} ${circ - fill}`}
          strokeLinecap="round"
          transform="rotate(-90 25 25)"
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center text-xs font-bold"
        style={{ color }}
      >
        {score}
      </span>
    </div>
  );
}

// ─── Score breakdown bars ─────────────────────────────────────────────────────
// Only the dimensions that actually vary across surfaced matches get a
// weighted progress bar. `eligibility` and `geographic` are hard gates
// (see lib/matching/score-calculator.ts) — every match that reaches this UI
// has already passed both, so they're always 100% and would just render as
// two permanently-full bars implying differentiation that isn't there.
// They're shown instead as a simple pass/fail confirmation line below.
const DIMENSION_WEIGHTS: { key: keyof NonNullable<MatchItem["match"]["score_breakdown"]>; label: string; weight: number }[] = [
  { key: "semantic", label: "Semantic fit", weight: 50 },
  { key: "focus", label: "Focus overlap", weight: 35 },
  { key: "size", label: "Grant size fit", weight: 15 },
];

function ScoreBreakdown({ breakdown }: { breakdown: NonNullable<MatchItem["match"]["score_breakdown"]> }) {
  return (
    <div>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        Score composition
      </p>
      <div className="space-y-2">
        {DIMENSION_WEIGHTS.map(({ key, label, weight }) => {
          const pct = Math.round(Math.max(0, Math.min(1, breakdown[key] ?? 0)) * 100);
          return (
            <div key={key} className="flex items-center gap-2">
              <span className="w-24 shrink-0 text-[11px] text-slate-500">{label}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
              </div>
              <span className="w-14 shrink-0 text-right text-[10px] tabular-nums text-slate-400">
                {pct}% · {weight}w
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-2.5 flex items-center gap-3 text-[11px] text-slate-500">
        <span className="flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Eligible
        </span>
        <span className="flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3 text-emerald-500" /> In service area
        </span>
      </div>
    </div>
  );
}

// ─── Amount formatter ─────────────────────────────────────────────────────────
function fmt(n: number) {
  return n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000 ? `$${(n / 1_000).toFixed(0)}K`
    : `$${n.toLocaleString()}`;
}

// ─── Funder type badge ────────────────────────────────────────────────────────
const FUNDER_COLORS: Record<string, string> = {
  federal_government: "bg-purple-50 text-purple-700 border-purple-100",
  foundation:         "bg-blue-50 text-blue-700 border-blue-100",
  corporate:          "bg-emerald-50 text-emerald-700 border-emerald-100",
  state_government:   "bg-orange-50 text-orange-700 border-orange-100",
  local_government:   "bg-amber-50 text-amber-700 border-amber-100",
};

// ─── Match Card ───────────────────────────────────────────────────────────────
interface MatchItem {
  match: {
    id: string;
    status: string;
    match_score: number;
    success_probability: number;
    match_reasons: string[];
    disqualifiers: string[];
    recommended_action: string;
    analysis_confidence?: "high" | "medium" | "low" | null;
    score_breakdown?: {
      semantic: number;
      focus: number;
      eligibility: number;
      geographic: number;
      size: number;
    };
  };
  opportunity: {
    id: string;
    title: string;
    funder_name: string;
    funder_type: string;
    amount_min: number | null;
    amount_max: number | null;
    deadline: string | null;
    focus_areas: string[];
    source_url: string;
    ai_summary?: string;
  };
  match_score: number;
  success_probability: number;
  match_reasons: string[];
  disqualifiers: string[];
  recommended_action: string;
}

function MatchCard({ item, inPipeline }: { item: MatchItem; inPipeline: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const addToPipeline = useAddToPipeline();
  const updateStatus = useUpdateMatchStatus();
  const [added, setAdded] = useState(false);
  // Captured once on mount rather than read via Date.now() during render —
  // the React Compiler flags Date.now() as an impure render-time call.
  const [now] = useState(() => Date.now());
  const opp = item.opportunity;
  const match = item.match;
  const isSaved = match.status === "saved";
  const isInPipeline = added || inPipeline;
  const score = match.match_score;
  const prob = match.success_probability;
  const reasons = match.match_reasons ?? [];
  const disqualifiers = match.disqualifiers ?? [];
  const breakdown = match.score_breakdown;
  const confidence = match.analysis_confidence;
  const badgeClass = FUNDER_COLORS[opp.funder_type] ?? "bg-slate-100 text-slate-600 border-slate-200";
  const funderLabel = opp.funder_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const probColor =
    prob >= 60 ? "text-emerald-600 bg-emerald-50" :
    prob >= 35 ? "text-amber-600 bg-amber-50"   : "text-red-600 bg-red-50";

  const daysLeft = useMemo(
    () =>
      opp.deadline
        ? Math.ceil((new Date(opp.deadline).getTime() - now) / 86_400_000)
        : null,
    [opp.deadline, now],
  );
  const urgent = daysLeft !== null && daysLeft <= 14 && daysLeft >= 0;

  return (
    <article className="rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md overflow-hidden">
      <div className="p-5">
        <div className="flex items-start gap-4">
          <ScoreRing score={score} />

          <div className="flex-1 min-w-0">
            {/* Title + type badge */}
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badgeClass}`}>
                {funderLabel}
              </span>
              {urgent && (
                <span className="rounded-full border border-red-100 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                  {daysLeft === 0 ? "Due today" : `${daysLeft}d left`}
                </span>
              )}
            </div>

            <h3 className="font-semibold text-slate-900 leading-snug line-clamp-2 hover:text-blue-600 transition">
              {opp.title}
            </h3>
            <p className="mt-0.5 text-sm text-slate-500">{opp.funder_name}</p>

            {/* Meta row */}
            <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-400">
              {(opp.amount_min || opp.amount_max) && (
                <span className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  {opp.amount_min && opp.amount_max
                    ? `${fmt(opp.amount_min)} – ${fmt(opp.amount_max)}`
                    : opp.amount_max ? `Up to ${fmt(opp.amount_max)}`
                    : `From ${fmt(opp.amount_min!)}`}
                </span>
              )}
              {opp.deadline && (
                <span className={`flex items-center gap-1 ${urgent ? "text-red-500 font-medium" : ""}`}>
                  <Calendar className="h-3 w-3" />
                  {new Date(opp.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              )}
              <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${probColor}`}>
                {prob}% success probability
              </span>
              {confidence && confidence !== "high" && (
                <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                  {confidence} confidence
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Focus area tags */}
        {opp.focus_areas?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {opp.focus_areas.slice(0, 4).map((a) => (
              <span key={a} className="rounded-full border border-slate-100 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-500">
                {a}
              </span>
            ))}
          </div>
        )}

        {/* AI summary */}
        {opp.ai_summary && (
          <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2.5 text-xs leading-relaxed text-blue-800 border border-blue-100">
            {opp.ai_summary}
          </p>
        )}
      </div>

      {/* Expandable reasoning */}
      {(reasons.length > 0 || disqualifiers.length > 0 || breakdown) && (
        <div className="border-t border-slate-100">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex w-full items-center justify-between px-5 py-2.5 text-xs font-medium text-slate-500 hover:bg-slate-50 transition"
          >
            <span className="flex items-center gap-1.5">
              <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
              Why this match?
            </span>
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>

          {expanded && (
            <div className="space-y-4 px-5 pb-4">
            {breakdown && <ScoreBreakdown breakdown={breakdown} />}
            <div className="grid gap-4 sm:grid-cols-2">
              {reasons.length > 0 && (
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-600">
                    Strengths
                  </p>
                  <ul className="space-y-1.5">
                    {reasons.map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {disqualifiers.length > 0 && (
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-red-500">
                    Watch out
                  </p>
                  <ul className="space-y-1.5">
                    {disqualifiers.map((d, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                        <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 border-t border-slate-100 bg-slate-50/50 px-5 py-3">
        {match.recommended_action && (
          <p className="flex-1 truncate text-[11px] italic text-slate-400">
            {match.recommended_action}
          </p>
        )}
        <div className="flex shrink-0 items-center gap-2">
          <a
            href={opp.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
          >
            Apply <ExternalLink className="h-3 w-3" />
          </a>
          <button
            onClick={() => {
              if (updateStatus.isPending) return;
              updateStatus.mutate({ id: match.id, status: isSaved ? "new" : "saved" });
            }}
            disabled={updateStatus.isPending}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
              isSaved
                ? "border-blue-200 bg-blue-50 text-blue-700"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {updateStatus.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Bookmark className={`h-3 w-3 ${isSaved ? "fill-blue-600" : ""}`} />
            )}
            {isSaved ? "Saved" : "Save"}
          </button>
          <button
            onClick={() => {
              if (isInPipeline || addToPipeline.isPending) return;
              addToPipeline.mutate(
                { opportunity_id: opp.id, title: opp.title, match_id: match.id, deadline: opp.deadline },
                { onSuccess: () => setAdded(true) },
              );
            }}
            disabled={isInPipeline || addToPipeline.isPending}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:cursor-default ${
              isInPipeline
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {addToPipeline.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : isInPipeline ? (
              <Check className="h-3 w-3" />
            ) : (
              <Plus className="h-3 w-3" />
            )}
            {isInPipeline ? "In Pipeline" : "Pipeline"}
          </button>
        </div>
      </div>
    </article>
  );
}

// ─── Upgrade banner (shown when the API reports plan_limited results) ─────────
function UpgradeBanner({
  maxVisibleMatches, totalMatches, onDismiss,
}: {
  maxVisibleMatches: number; totalMatches: number; onDismiss: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
      <Zap className="h-4 w-4 shrink-0 text-blue-500" />
      <p className="flex-1">
        Showing your top {maxVisibleMatches} of {totalMatches} matches —{" "}
        <Link href="/dashboard/settings" className="font-semibold underline hover:text-blue-900">
          Upgrade to Pro
        </Link>{" "}
        to see them all.
      </p>
      <button
        onClick={onDismiss}
        className="shrink-0 rounded-lg p-1 text-blue-400 transition hover:bg-blue-100 hover:text-blue-600"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─── Stats Mini ───────────────────────────────────────────────────────────────
function StatPill({
  icon: Icon, label, value, color,
}: {
  icon: React.ElementType; label: string; value: number; color: string;
}) {
  return (
    <div className={`flex items-center gap-3 rounded-xl border bg-white p-4 shadow-sm ${color}`}>
      <Icon className="h-4 w-4 shrink-0" />
      <div>
        <p className="text-xl font-bold text-slate-900 leading-none">{value}</p>
        <p className="mt-0.5 text-xs text-slate-500">{label}</p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
const STATUS_TABS = [
  { label: "All",     value: "" },
  { label: "New",     value: "new" },
  { label: "Saved",   value: "saved" },
  { label: "Applied", value: "applied" },
];

export default function MatchesPage() {
  const [activeTab, setActiveTab] = useState("");
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const { data, isLoading, error } = useMatches();
  const { data: pipeline } = usePipeline();
  const { data: profile } = useProfile();
  const matches = (data?.data ?? []) as MatchItem[];
  const stats = data?.stats;
  const planLimited = data?.plan_limited === true;
  const totalMatches = data?.total_matches;

  // A profile is "ready for matching" once an org exists with enough completeness.
  const hasProfile = !!profile?.organization && (profile?.profile_completeness ?? 0) >= 30;

  const pipelineOppIds = new Set<string>(
    (Array.isArray(pipeline) ? pipeline : []).map((p: { opportunity_id: string }) => p.opportunity_id),
  );

  const filtered = activeTab
    ? matches.filter((m) => m.match.status === activeTab)
    : matches;
  const activeTabLabel = STATUS_TABS.find((t) => t.value === activeTab)?.label ?? "All";

  return (
    <div className="max-w-4xl space-y-6">
      {/* Page header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900">My Matches</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          AI-curated grants ranked by organizational fit
        </p>
      </div>

      {/* Upgrade banner — shown when /api/matches reports plan_limited results */}
      {planLimited && !bannerDismissed && totalMatches !== undefined && (
        <UpgradeBanner
          maxVisibleMatches={matches.length}
          totalMatches={totalMatches}
          onDismiss={() => setBannerDismissed(true)}
        />
      )}

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          <StatPill icon={Sparkles}    label="Total matches"    value={stats.total_matches}       color="border-blue-100 [&>svg]:text-blue-500" />
          <StatPill icon={TrendingUp}  label="Strong (≥70%)"   value={stats.strong_matches}      color="border-emerald-100 [&>svg]:text-emerald-500" />
          <StatPill icon={Clock}       label="New today"        value={stats.new_since_last_visit} color="border-violet-100 [&>svg]:text-violet-500" />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm w-fit">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
              activeTab === tab.value
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 rounded-xl bg-white border border-slate-100 animate-pulse" />
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load matches. Please try again.
        </div>
      )}

      {/* Empty state — distinguishes "filter is empty" vs "no matches" vs "no profile" */}
      {!isLoading && !error && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
            <Sparkles className="h-6 w-6 text-slate-400" />
          </div>

          {matches.length > 0 ? (
            // Has matches, just none under the current filter tab
            <>
              <p className="mt-4 text-base font-semibold text-slate-700">
                No {activeTabLabel.toLowerCase()} grants
              </p>
              <p className="mt-1 text-sm text-slate-400">
                {activeTab === "saved"
                  ? "Tap Save on a match to bookmark it here."
                  : activeTab === "applied"
                    ? "Mark a grant as applied to track it here."
                    : activeTab === "new"
                      ? "You're all caught up — no new matches right now."
                      : "Try a different filter."}
              </p>
              <button
                onClick={() => setActiveTab("")}
                className="mt-5 rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                View all matches
              </button>
            </>
          ) : hasProfile ? (
            // Profile is complete but no matches computed yet
            <>
              <p className="mt-4 text-base font-semibold text-slate-700">No matches yet</p>
              <p className="mt-1 text-sm text-slate-400 max-w-sm">
                We&apos;re scoring grants against your profile. New opportunities sync every few hours — check back soon.
              </p>
              <Link
                href="/dashboard/opportunities"
                className="mt-5 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Browse all opportunities
              </Link>
            </>
          ) : (
            // No profile yet — onboarding genuinely needed
            <>
              <p className="mt-4 text-base font-semibold text-slate-700">Complete your profile</p>
              <p className="mt-1 text-sm text-slate-400">Add your organization details to get AI-powered grant matches.</p>
              <Link
                href="/onboarding"
                className="mt-5 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Complete Profile
              </Link>
            </>
          )}
        </div>
      )}

      {/* Match cards */}
      {!isLoading && filtered.length > 0 && (
        <div className="space-y-4">
          {filtered.map((item) => (
            <MatchCard
              key={item.match.id}
              item={item}
              inPipeline={pipelineOppIds.has(item.opportunity.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
