"use client";

import { Brain, Globe, Kanban, Bell, Sparkles, BarChart3 } from "lucide-react";

const features = [
  {
    icon: Brain,
    title: "AI-Powered Matching",
    description:
      "Semantic vector similarity surfaces grants aligned to your exact mission, focus area, and geographic scope — not just keyword matches.",
    gradient: "from-blue-600 to-blue-500",
    glow: "shadow-blue-500/25",
    ring: "ring-blue-500/20",
    badge: "bg-blue-50 text-blue-700",
    tag: "Machine Learning",
  },
  {
    icon: Globe,
    title: "Real-Time Discovery",
    description:
      "Live ingestion of federal grants via Grants.gov, plus hundreds of private foundations. Never miss a deadline again.",
    gradient: "from-indigo-600 to-indigo-500",
    glow: "shadow-indigo-500/25",
    ring: "ring-indigo-500/20",
    badge: "bg-indigo-50 text-indigo-700",
    tag: "Live Data",
  },
  {
    icon: Kanban,
    title: "Pipeline Management",
    description:
      "Track every application from discovery to award in a kanban-style pipeline built for grant teams of all sizes.",
    gradient: "from-violet-600 to-violet-500",
    glow: "shadow-violet-500/25",
    ring: "ring-violet-500/20",
    badge: "bg-violet-50 text-violet-700",
    tag: "Workflow",
  },
  {
    icon: Bell,
    title: "Smart Alerts",
    description:
      "Automated deadline reminders and new-opportunity notifications delivered before it is too late to apply.",
    gradient: "from-amber-600 to-amber-500",
    glow: "shadow-amber-500/25",
    ring: "ring-amber-500/20",
    badge: "bg-amber-50 text-amber-700",
    tag: "Automation",
  },
  {
    icon: Sparkles,
    title: "Profile Intelligence",
    description:
      "AI extracts your mission, beneficiaries, budget, and geography from existing documents in under two minutes.",
    gradient: "from-emerald-600 to-emerald-500",
    glow: "shadow-emerald-500/25",
    ring: "ring-emerald-500/20",
    badge: "bg-emerald-50 text-emerald-700",
    tag: "AI Extraction",
  },
  {
    icon: BarChart3,
    title: "Analytics Dashboard",
    description:
      "Track match scores, application success rates, and funding trends to refine your strategy over time.",
    gradient: "from-rose-600 to-rose-500",
    glow: "shadow-rose-500/25",
    ring: "ring-rose-500/20",
    badge: "bg-rose-50 text-rose-700",
    tag: "Insights",
  },
];

export default function Features() {
  return (
    <section id="features" className="bg-white px-6 py-24 md:px-10">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-16 text-center">
          <div className="mb-4 inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-blue-600">
            Features
          </div>
          <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900 md:text-5xl">
            Everything your grant team needs
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-500 leading-relaxed">
            From first discovery to final submission, GrantPilot handles the
            research so your team can focus on writing and relationships.
          </p>
        </div>

        {/* Grid */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="group relative rounded-2xl border border-slate-100 bg-white p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-200/60 hover:border-slate-200"
              >
                {/* Gradient icon container */}
                <div
                  className={`mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${feature.gradient} shadow-lg ${feature.glow} ring-1 ${feature.ring}`}
                >
                  <Icon className="h-5 w-5 text-white" />
                </div>

                {/* Tag */}
                <span
                  className={`mb-3 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${feature.badge}`}
                >
                  {feature.tag}
                </span>

                <h3 className="mb-2.5 text-lg font-bold text-slate-900">
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed text-slate-500">
                  {feature.description}
                </p>

                {/* Subtle bottom gradient on hover */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px rounded-b-2xl bg-gradient-to-r from-transparent via-slate-200 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
