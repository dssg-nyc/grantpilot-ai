"use client";

import { ArrowRight, Play, TrendingUp, Users, Target, Sparkles } from "lucide-react";

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-white px-6 py-28 md:px-10 md:py-36">
      {/* Background accents */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-blue-50 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-indigo-50 blur-3xl" />
      <div className="pointer-events-none absolute left-0 top-1/3 h-[300px] w-[300px] rounded-full bg-blue-50/70 blur-3xl" />

      {/* Subtle grid overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,45,114,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(0,45,114,0.8) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />

      <div className="relative mx-auto max-w-6xl">
        {/* Animated trust badge */}
        <div className="inline-flex items-center gap-2.5 rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-600" />
          </span>
          <Sparkles className="h-3.5 w-3.5 text-blue-600" />
          AI-powered grant discovery for nonprofits
        </div>

        {/* Headline */}
        <h1 className="mt-8 max-w-5xl font-display text-5xl font-bold tracking-tight text-slate-900 md:text-6xl lg:text-7xl xl:text-8xl">
          Your AI Fundraising{" "}
          <span className="bg-gradient-to-r from-blue-800 via-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Co-Pilot
          </span>{" "}
          <span className="text-slate-500">for Nonprofits</span>
        </h1>

        {/* Subheadline */}
        <p className="mt-7 max-w-2xl text-lg leading-relaxed text-slate-600 md:text-xl">
          Find best-fit grants in minutes, not weeks. GrantPilot continuously
          discovers, scores, and surfaces funding opportunities perfectly
          aligned to your mission.
        </p>

        {/* CTA buttons */}
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <a
            href="/signup"
            className="group inline-flex items-center gap-2 rounded-full bg-indigo-600 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-indigo-600/25 transition-all duration-200 hover:bg-indigo-500 hover:shadow-indigo-600/35 hover:shadow-xl hover:-translate-y-0.5"
          >
            Start Free
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </a>
          <a
            href="#demo"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-7 py-3.5 text-base font-semibold text-slate-700 transition-all duration-200 hover:border-slate-300 hover:bg-slate-50"
          >
            <Play className="h-4 w-4 fill-slate-700" />
            Watch Demo
          </a>
        </div>

        {/* Capability row */}
        <div className="mt-20 flex flex-wrap gap-8 border-t border-slate-100 pt-10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 ring-1 ring-blue-100">
              <TrendingUp className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">Federal + Foundation</p>
              <p className="text-sm text-slate-500">grant sources, unified</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 ring-1 ring-indigo-100">
              <Sparkles className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">AI-Powered</p>
              <p className="text-sm text-slate-500">composite match scoring</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 ring-1 ring-emerald-100">
              <Target className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">Synced every 4hrs</p>
              <p className="text-sm text-slate-500">never a stale spreadsheet</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 ring-1 ring-violet-100">
              <Users className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">NYC DSSG</p>
              <p className="text-sm text-slate-500">built pro bono for nonprofits</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
