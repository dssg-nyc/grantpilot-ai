"use client";

import { UserCircle, Zap, CheckCircle } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: UserCircle,
    title: "Build Your Profile",
    subtitle: "2-minute onboarding",
    description:
      "Answer a few questions and optionally paste existing grant text. Our AI extracts your mission, focus areas, target beneficiaries, geographic scope, and typical budget range automatically.",
    highlights: [
      "AI document extraction",
      "Mission & focus area mapping",
      "Geographic and budget filters",
    ],
    iconGradient: "from-blue-600 to-blue-500",
    iconGlow: "shadow-blue-500/30",
    numberColor: "text-blue-100",
    badgeBg: "bg-blue-50 text-blue-700",
    dotColor: "bg-blue-500",
    borderAccent: "border-blue-100",
    lineColor: "from-blue-200",
  },
  {
    number: "02",
    icon: Zap,
    title: "Get Matched",
    subtitle: "Continuous scoring",
    description:
      "GrantPilot runs vector similarity against 10,000+ live opportunities every day. A composite score weighing mission alignment, eligibility, deadline urgency, and award size surfaces your best fits first.",
    highlights: [
      "Semantic vector matching",
      "Composite relevance scoring",
      "Daily re-ranking as new grants arrive",
    ],
    iconGradient: "from-indigo-600 to-indigo-500",
    iconGlow: "shadow-indigo-500/30",
    numberColor: "text-indigo-100",
    badgeBg: "bg-indigo-50 text-indigo-700",
    dotColor: "bg-indigo-500",
    borderAccent: "border-indigo-100",
    lineColor: "via-indigo-200",
  },
  {
    number: "03",
    icon: CheckCircle,
    title: "Apply With Confidence",
    subtitle: "Pipeline & guidance",
    description:
      "Move opportunities into your pipeline, track deadlines, and use AI-generated summaries to prioritize where to invest your writing time. Know your fit before you write a single word.",
    highlights: [
      "Kanban grant pipeline",
      "Deadline reminders",
      "AI fit summaries",
    ],
    iconGradient: "from-violet-600 to-violet-500",
    iconGlow: "shadow-violet-500/30",
    numberColor: "text-violet-100",
    badgeBg: "bg-violet-50 text-violet-700",
    dotColor: "bg-violet-500",
    borderAccent: "border-violet-100",
    lineColor: "to-violet-200",
  },
];

export default function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="relative overflow-hidden bg-slate-950 px-6 py-24 md:px-10"
    >
      {/* Background orbs */}
      <div className="pointer-events-none absolute left-1/4 top-0 h-[500px] w-[500px] -translate-y-1/2 rounded-full bg-blue-600/8 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-1/4 h-[400px] w-[400px] translate-y-1/3 rounded-full bg-violet-600/8 blur-3xl" />

      <div className="relative mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-16 text-center">
          <div className="mb-4 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-blue-400">
            How It Works
          </div>
          <h2 className="text-3xl font-black tracking-tight text-white md:text-5xl">
            From zero to funded in{" "}
            <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
              three steps
            </span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-400 leading-relaxed">
            No setup headaches. No spreadsheet maintenance. Just tell GrantPilot
            about your organization and let AI do the legwork.
          </p>
        </div>

        {/* Steps grid */}
        <div className="relative grid gap-6 lg:grid-cols-3">
          {/* Connecting line (desktop) */}
          <div className="pointer-events-none absolute left-0 right-0 top-[52px] hidden h-px bg-gradient-to-r from-blue-500/30 via-indigo-500/30 to-violet-500/30 lg:block" />

          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <div
                key={step.number}
                className="group relative flex flex-col rounded-2xl border border-white/8 bg-white/3 p-8 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-white/15 hover:bg-white/6"
              >
                {/* Number watermark */}
                <span
                  className={`absolute right-6 top-4 text-7xl font-black tracking-tighter ${step.numberColor} select-none opacity-40`}
                >
                  {step.number}
                </span>

                {/* Icon */}
                <div
                  className={`relative z-10 mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${step.iconGradient} shadow-xl ${step.iconGlow}`}
                >
                  <Icon className="h-6 w-6 text-white" />
                </div>

                {/* Badge */}
                <span
                  className={`mb-3 inline-block self-start rounded-full px-3 py-0.5 text-xs font-semibold ${step.badgeBg}`}
                >
                  {step.subtitle}
                </span>

                <h3 className="mb-3 text-xl font-bold text-white">
                  {step.title}
                </h3>
                <p className="mb-6 flex-1 text-sm leading-relaxed text-slate-400">
                  {step.description}
                </p>

                {/* Highlights */}
                <ul className="space-y-2.5 border-t border-white/6 pt-5">
                  {step.highlights.map((item) => (
                    <li
                      key={item}
                      className="flex items-center gap-2.5 text-sm text-slate-300"
                    >
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${step.dotColor}`}
                      />
                      {item}
                    </li>
                  ))}
                </ul>

                {/* Step connector dots (desktop) */}
                {idx < 2 && (
                  <div className="absolute -right-3 top-[52px] z-20 hidden h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border-2 border-slate-700 bg-slate-900 lg:flex">
                    <div className="h-2 w-2 rounded-full bg-slate-500" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
