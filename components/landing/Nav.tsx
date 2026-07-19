"use client";

import Link from "next/link";
import { Landmark } from "lucide-react";

export default function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3.5 md:px-10">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-700 to-blue-900 shadow-sm">
            <Landmark className="h-4 w-4 text-white" />
          </div>
          <div className="leading-none">
            <span className="block text-base font-bold tracking-tight text-slate-900">
              GrantPilot AI
            </span>
            <span className="block mt-0.5 text-[11px] font-medium text-slate-400">
              by DSSG NYC
            </span>
          </div>
        </Link>

        <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">
          <a href="#features" className="transition-colors hover:text-slate-900">
            Features
          </a>
          <a href="#how-it-works" className="transition-colors hover:text-slate-900">
            How It Works
          </a>
          <a
            href="https://www.nyc-dssg.org"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700 transition-colors hover:border-blue-200 hover:bg-blue-100"
          >
            Part of NYC DSSG
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="hidden text-sm font-semibold text-slate-600 transition-colors hover:text-slate-900 sm:inline-block"
          >
            Log In
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-500"
          >
            Start Free
          </Link>
        </div>
      </div>
    </header>
  );
}
