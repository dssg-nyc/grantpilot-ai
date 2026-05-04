"use client";

import { ArrowRight, Play, TrendingUp, Users, Target, Sparkles } from "lucide-react";

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-6 py-28 md:px-10 md:py-36">
      {/* Background orb effects */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-blue-500/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-indigo-600/15 blur-3xl" />
      <div className="pointer-events-none absolute left-0 top-1/3 h-[300px] w-[300px] rounded-full bg-blue-700/10 blur-3xl" />

      {/* Subtle grid overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />

      <div className="relative mx-auto max-w-6xl">
        {/* Animated trust badge */}
        <div className="inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-blue-300 backdrop-blur-sm">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-400" />
          </span>
          <Sparkles className="h-3.5 w-3.5 text-blue-400" />
          Trusted by 500+ nonprofits — AI-powered grant discovery
        </div>

        {/* Headline */}
        <h1 className="mt-8 max-w-5xl text-5xl font-black tracking-tight text-white md:text-6xl lg:text-7xl xl:text-8xl">
          Your AI Fundraising{" "}
          <span className="bg-gradient-to-r from-blue-400 via-blue-300 to-indigo-400 bg-clip-text text-transparent">
            Co-Pilot
          </span>{" "}
          <span className="text-slate-300">for Nonprofits</span>
        </h1>

        {/* Subheadline */}
        <p className="mt-7 max-w-2xl text-lg leading-relaxed text-slate-400 md:text-xl">
          Find best-fit grants in minutes, not weeks. GrantPilot continuously
          discovers, scores, and surfaces funding opportunities perfectly
          aligned to your mission.
        </p>

        {/* CTA buttons */}
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <a
            href="/signup"
            className="group inline-flex items-center gap-2 rounded-xl bg-blue-600 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-blue-900/40 transition-all duration-200 hover:bg-blue-500 hover:shadow-blue-800/50 hover:shadow-xl hover:-translate-y-0.5"
          >
            Start Free
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </a>
          <a
            href="#demo"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-7 py-3.5 text-base font-semibold text-white backdrop-blur-sm transition-all duration-200 hover:bg-white/10 hover:border-white/20"
          >
            <Play className="h-4 w-4 fill-white" />
            Watch Demo
          </a>
        </div>

        {/* Social proof stat row */}
        <div className="mt-20 flex flex-wrap gap-8 border-t border-white/8 pt-10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15 ring-1 ring-blue-500/20">
              <TrendingUp className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-white">10,000+</p>
              <p className="text-sm text-slate-500">grants tracked</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/15 ring-1 ring-indigo-500/20">
              <Users className="h-5 w-5 text-indigo-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-white">500+</p>
              <p className="text-sm text-slate-500">nonprofits served</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-500/20">
              <Target className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-white">87%</p>
              <p className="text-sm text-slate-500">match accuracy</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15 ring-1 ring-violet-500/20">
              <TrendingUp className="h-5 w-5 text-violet-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-white">$2.4B</p>
              <p className="text-sm text-slate-500">in grants tracked</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
