"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, CheckCircle2, Loader2, AlertCircle, Landmark } from "lucide-react";
import { OrgProfile } from "@/types/profile";
import WebsiteImport from "@/components/onboarding/WebsiteImport";
import OrgInfoStep from "@/components/onboarding/steps/OrgInfoStep";
import MissionStep from "@/components/onboarding/steps/MissionStep";
import FocusAreasStep from "@/components/onboarding/steps/FocusAreasStep";
import OperationalStep from "@/components/onboarding/steps/OperationalStep";
import FundingHistoryStep from "@/components/onboarding/steps/FundingHistoryStep";
import PreferencesStep from "@/components/onboarding/steps/PreferencesStep";

const STEPS = [
  { label: "Organization", shortLabel: "Org Info",  description: "Basic details about your nonprofit" },
  { label: "Mission",      shortLabel: "Mission",   description: "Your purpose and the people you serve" },
  { label: "Focus Areas",  shortLabel: "Focus",     description: "Key issue areas and SDG alignments" },
  { label: "Operations",   shortLabel: "Ops",       description: "Budget, staff, and service geography" },
  { label: "Funding",      shortLabel: "Funding",   description: "Grant history and funding preferences" },
  { label: "Preferences",  shortLabel: "Prefs",     description: "Match settings and notification options" },
];

// Required fields per step. Returns an error message, or null when the step is
// valid. Keeps users from advancing with data the matching engine depends on
// (focus areas, budget, geography) left blank.
function validateStep(step: number, data: Partial<OrgProfile>): string | null {
  switch (step) {
    case 0:
      if (!data.legal_name?.trim()) return "Enter your organization's legal name to continue.";
      return null;
    case 1:
      if (!data.mission_statement || data.mission_statement.trim().length < 20)
        return "Add a mission statement (at least 20 characters) — it powers your matches.";
      return null;
    case 2:
      if (!data.primary_focus_areas?.length)
        return "Select at least one primary focus area.";
      return null;
    case 3:
      if (!data.annual_budget_range) return "Select your annual operating budget range.";
      if (!data.geographic_service_area) return "Select your geographic service area.";
      return null;
    default:
      return null;
  }
}

const INITIAL_DATA: Partial<OrgProfile> = {
  legal_name: "",
  org_type: "ngo",
  primary_focus_areas: [],
  secondary_focus_areas: [],
  target_beneficiaries: [],
  geographic_service_area: "local",
  service_states: [],
  service_cities: [],
  sdg_alignments: [],
  programs: [],
  preferred_grant_types: [],
  previous_funder_types: [],
  match_score_threshold: 50,
  notification_frequency: "weekly",
};

export default function OnboardingWizard({ initialData }: { initialData?: Partial<OrgProfile> }) {
  const router = useRouter();
  const isEditing = !!initialData;
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState<Partial<OrgProfile>>(
    initialData ? { ...INITIAL_DATA, ...initialData } : INITIAL_DATA,
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function handleChange(updates: Partial<OrgProfile>) {
    setData((prev) => ({ ...prev, ...updates }));
  }

  function handleBack() {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
      setSubmitError(null);
    }
  }

  function handleNext() {
    const validationError = validateStep(currentStep, data);
    if (validationError) {
      setSubmitError(validationError);
      return;
    }
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((s) => s + 1);
      setSubmitError(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  async function handleSubmit() {
    // Re-validate every gating step before the final POST.
    for (let s = 0; s <= currentStep; s++) {
      const validationError = validateStep(s, data);
      if (validationError) {
        setCurrentStep(s);
        setSubmitError(validationError);
        return;
      }
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Server error: ${res.status}`);
      }
      fetch("/api/matches/compute", { method: "POST" }).catch(() => null);
      router.push(isEditing ? "/dashboard/profile" : "/dashboard");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const isLastStep = currentStep === STEPS.length - 1;
  const progressPct = Math.round(((currentStep + 1) / STEPS.length) * 100);

  const stepComponents = [
    <div key="org" className="space-y-5">
      {/* Only offered on a fresh signup. When editing an existing profile,
          re-scraping the website would silently overwrite corrections the
          user has already made by hand. */}
      {!isEditing && <WebsiteImport onApply={handleChange} />}
      <OrgInfoStep data={data} onChange={handleChange} />
    </div>,
    <MissionStep       key="mission" data={data} onChange={handleChange} />,
    <FocusAreasStep    key="focus"   data={data} onChange={handleChange} />,
    <OperationalStep   key="ops"     data={data} onChange={handleChange} />,
    <FundingHistoryStep key="funding" data={data} onChange={handleChange} />,
    <PreferencesStep   key="prefs"   data={data} onChange={handleChange} />,
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Left panel */}
      <div className="hidden lg:flex w-72 xl:w-80 flex-col border-r border-slate-200 bg-white p-8">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-12">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-700 to-blue-900 shadow-sm">
            <Landmark className="h-4 w-4 text-white" />
          </div>
          <div className="leading-none">
            <span className="block text-sm font-bold text-slate-900">GrantPilot AI</span>
            <span className="block mt-0.5 text-[10px] font-medium text-slate-400">by DSSG NYC</span>
          </div>
        </div>

        {/* Step list */}
        <nav className="flex-1 space-y-1">
          {STEPS.map((step, index) => {
            const done    = index < currentStep;
            const current = index === currentStep;
            return (
              <div
                key={step.label}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition ${
                  current ? "bg-blue-50" : done ? "opacity-70" : "opacity-40"
                }`}
              >
                <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition ${
                  done    ? "bg-emerald-500 text-white" :
                  current ? "bg-blue-600 text-white ring-2 ring-blue-200" :
                            "bg-slate-100 text-slate-400"
                }`}>
                  {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : index + 1}
                </div>
                <div>
                  <p className={`text-sm font-semibold ${current ? "text-slate-900" : "text-slate-600"}`}>
                    {step.label}
                  </p>
                  <p className="text-[11px] text-slate-400 leading-tight">{step.description}</p>
                </div>
              </div>
            );
          })}
        </nav>

        {/* Progress */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400">Profile completion</span>
            <span className="text-xs font-bold text-slate-600">{progressPct}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-100">
            <div
              className="h-1.5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 flex-col">
        {/* Mobile header */}
        <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-6 py-4 lg:hidden">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-blue-700 to-blue-900">
            <Landmark className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-sm font-bold text-slate-900">GrantPilot AI</span>
          <span className="ml-auto text-xs text-slate-400">
            Step {currentStep + 1} of {STEPS.length}
          </span>
        </div>

        {/* Mobile progress bar */}
        <div className="h-0.5 bg-slate-100 lg:hidden">
          <div
            className="h-full bg-blue-600 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Form area */}
        <div className="flex flex-1 flex-col items-center justify-start px-4 py-8 sm:px-8">
          <div className="w-full max-w-2xl">
            {/* Step title */}
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-widest text-blue-700 mb-1">
                Step {currentStep + 1} of {STEPS.length}
              </p>
              <h1 className="font-display text-2xl font-bold text-slate-900">{STEPS[currentStep].label}</h1>
              <p className="mt-1 text-sm text-slate-500">{STEPS[currentStep].description}</p>
            </div>

            {/* Form card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
              {stepComponents[currentStep]}
            </div>

            {/* Error */}
            {submitError && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            {/* Navigation */}
            <div className="mt-6 flex items-center justify-between">
              <button
                type="button"
                onClick={handleBack}
                disabled={currentStep === 0}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>

              {isLastStep ? (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
                  ) : (
                    <><CheckCircle2 className="h-4 w-4" /> Complete Profile</>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleNext}
                  className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-500"
                >
                  Continue
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
