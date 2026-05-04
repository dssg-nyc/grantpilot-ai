"use client";

import { DollarSign, Search, Users, Target, ArrowRight } from "lucide-react";

const stats = [
  {
    icon: DollarSign,
    value: "$2.4B",
    label: "in grants tracked",
    description: "Across federal and private foundation sources",
    glow: "shadow-emerald-400/20",
    ring: "ring-emerald-400/20",
    iconBg: "bg-emerald-400/10",
    iconColor: "text-emerald-300",
    valueGradient: "from-emerald-300 to-emerald-100",
  },
  {
    icon: Search,
    value: "10,000+",
    label: "opportunities",
    description: "Updated daily from live data feeds",
    glow: "shadow-blue-400/20",
    ring: "ring-blue-400/20",
    iconBg: "bg-blue-400/10",
    iconColor: "text-blue-300",
    valueGradient: "from-blue-300 to-blue-100",
  },
  {
    icon: Users,
    value: "500+",
    label: "nonprofits served",
    description: "From grassroots orgs to national foundations",
    glow: "shadow-indigo-400/20",
    ring: "ring-indigo-400/20",
    iconBg: "bg-indigo-400/10",
    iconColor: "text-indigo-300",
    valueGradient: "from-indigo-300 to-indigo-100",
  },
  {
    icon: Target,
    value: "87%",
    label: "match accuracy",
    description: "Relevance confirmed by grant writers",
    glow: "shadow-violet-400/20",
    ring: "ring-violet-400/20",
    iconBg: "bg-violet-400/10",
    iconColor: "text-violet-300",
    valueGradient: "from-violet-300 to-violet-100",
  },
];

export default function Stats() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 px-6 py-24 md:px-10">
      {/* Dramatic background glow layers */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(59,130,246,0.4),_transparent_60%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(99,102,241,0.3),_transparent_50%)]" />
      <div className="pointer-events-none absolute -top-24 left-1/2 h-[400px] w-[800px] -translate-x-1/2 rounded-full bg-blue-400/10 blur-3xl" />

      {/* Subtle noise texture overlay */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          backgroundSize: "200px 200px",
        }}
      />

      <div className="relative mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-16 text-center">
          <div className="mb-4 inline-flex items-center rounded-full border border-white/15 bg-white/8 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-blue-100">
            By the Numbers
          </div>
          <h2 className="text-3xl font-black tracking-tight text-white md:text-5xl">
            Proven impact for nonprofits
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg text-blue-100/80 leading-relaxed">
            Thousands of organizations trust GrantPilot to power their grant
            discovery workflows every day.
          </p>
        </div>

        {/* Stats grid */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className={`group relative rounded-2xl border border-white/10 bg-white/8 p-7 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:bg-white/12 hover:shadow-2xl ${stat.glow}`}
              >
                {/* Icon */}
                <div
                  className={`mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl ${stat.iconBg} ring-1 ${stat.ring}`}
                >
                  <Icon className={`h-5 w-5 ${stat.iconColor}`} />
                </div>

                {/* Big number with gradient */}
                <p
                  className={`mb-1 bg-gradient-to-br ${stat.valueGradient} bg-clip-text text-5xl font-black tracking-tight text-transparent`}
                >
                  {stat.value}
                </p>
                <p className="mb-2 text-base font-semibold text-white">
                  {stat.label}
                </p>
                <p className="text-sm leading-relaxed text-blue-100/60">
                  {stat.description}
                </p>

                {/* Glow orb on hover */}
                <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  style={{ background: "radial-gradient(circle at 50% 0%, rgba(255,255,255,0.05), transparent 70%)" }}
                />
              </div>
            );
          })}
        </div>

        {/* CTA banner */}
        <div className="mt-14 overflow-hidden rounded-2xl border border-white/10 bg-white/8 p-8 backdrop-blur-sm md:p-10">
          <div className="flex flex-col items-center justify-between gap-6 text-center md:flex-row md:text-left">
            <div>
              <p className="text-xl font-bold text-white md:text-2xl">
                Ready to find your next grant?
              </p>
              <p className="mt-1.5 text-blue-100/70">
                Join hundreds of nonprofits discovering better-fit funding in
                less time.
              </p>
            </div>
            <a
              href="/signup"
              className="group inline-flex shrink-0 items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-base font-bold text-blue-700 shadow-xl shadow-blue-900/30 transition-all duration-200 hover:bg-blue-50 hover:-translate-y-0.5 hover:shadow-2xl"
            >
              Get Started Free
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
