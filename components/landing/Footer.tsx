"use client";

import { Landmark, ArrowUpRight } from "lucide-react";

const links = {
  Product: [
    { label: "Features", href: "#features" },
    { label: "How It Works", href: "#how-it-works" },
    { label: "Pricing", href: "/pricing" },
    { label: "Changelog", href: "/changelog" },
  ],
  Resources: [
    { label: "Grant Writing Guide", href: "/resources/grant-writing" },
    { label: "Nonprofit Blog", href: "/blog" },
    { label: "API Docs", href: "/docs" },
    { label: "Support", href: "/support" },
  ],
  Company: [
    { label: "About", href: "/about" },
    { label: "Careers", href: "/careers" },
    { label: "Contact", href: "/contact" },
    { label: "Press", href: "/press" },
  ],
};

export default function Footer() {
  return (
    <footer className="border-t border-slate-100 bg-white px-6 py-16 md:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand column */}
          <div>
            <a href="/" className="inline-flex items-center gap-2.5 group">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 shadow-sm shadow-blue-200 transition-shadow duration-200 group-hover:shadow-blue-300">
                <Landmark className="h-4 w-4 text-white" />
              </div>
              <span className="text-lg font-bold text-slate-900 tracking-tight">
                GrantPilot AI
              </span>
            </a>
            <p className="mt-4 text-sm leading-relaxed text-slate-500 max-w-xs">
              AI-powered grant discovery and pipeline management for
              mission-driven nonprofits.
            </p>
            <div className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-slate-50 border border-slate-100 px-3 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-xs text-slate-500">All systems operational</span>
            </div>
            <p className="mt-4 text-sm text-slate-400">
              aivialabs@gmail.com
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(links).map(([category, items]) => (
            <div key={category}>
              <h4 className="mb-5 text-xs font-semibold uppercase tracking-widest text-slate-400">
                {category}
              </h4>
              <ul className="space-y-3">
                {items.map((item) => (
                  <li key={item.label}>
                    <a
                      href={item.href}
                      className="group inline-flex items-center gap-1 text-sm text-slate-500 transition-colors duration-150 hover:text-slate-900"
                    >
                      {item.label}
                      <ArrowUpRight className="h-3 w-3 opacity-0 -translate-y-0.5 translate-x-0.5 transition-all duration-150 group-hover:opacity-100 group-hover:translate-y-0 group-hover:translate-x-0" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-slate-100 pt-8 sm:flex-row">
          <div className="flex items-center gap-3">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-gradient-to-br from-blue-600 to-indigo-600">
              <Landmark className="h-2.5 w-2.5 text-white" />
            </div>
            <p className="text-sm text-slate-400">
              &copy; 2026 GrantPilot AI. All rights reserved.
            </p>
          </div>
          <div className="flex items-center gap-6">
            <a
              href="/privacy"
              className="text-sm text-slate-400 transition-colors duration-150 hover:text-slate-700"
            >
              Privacy Policy
            </a>
            <a
              href="/terms"
              className="text-sm text-slate-400 transition-colors duration-150 hover:text-slate-700"
            >
              Terms of Service
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
