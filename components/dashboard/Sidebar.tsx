"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Sparkles,
  Search,
  Kanban,
  TrendingUp,
  Settings,
  Landmark,
  ChevronRight,
} from "lucide-react";

const NAV = [
  { label: "Dashboard",     href: "/dashboard",                icon: LayoutDashboard },
  { label: "My Matches",    href: "/dashboard/matches",        icon: Sparkles },
  { label: "Opportunities", href: "/dashboard/opportunities",  icon: Search },
  { label: "Pipeline",      href: "/dashboard/pipeline",       icon: Kanban },
  { label: "Trending",      href: "/dashboard/trending",       icon: TrendingUp },
  { label: "Settings",      href: "/dashboard/settings",       icon: Settings },
] as const;

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 md:flex flex-col bg-slate-950 border-r border-white/5">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 shadow-lg shadow-blue-600/30">
          <Landmark className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-white leading-none">GrantPilot</p>
          <p className="text-[10px] text-slate-400 mt-0.5">AI</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          Navigation
        </p>
        {NAV.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                active
                  ? "bg-blue-600/15 text-blue-400"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              }`}
            >
              <Icon className={`h-4 w-4 shrink-0 ${active ? "text-blue-400" : "text-slate-500 group-hover:text-slate-300"}`} />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight className="h-3 w-3 text-blue-500 opacity-60" />}
            </Link>
          );
        })}
      </nav>

      {/* Bottom hint */}
      <div className="m-3 rounded-xl bg-gradient-to-br from-blue-600/20 to-indigo-600/10 border border-blue-500/20 p-4">
        <p className="text-xs font-semibold text-blue-300">Grants updated</p>
        <p className="mt-0.5 text-xs text-slate-400">New opportunities every 4 hours</p>
        <div className="mt-2 flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] text-emerald-400 font-medium">Live sync active</span>
        </div>
      </div>
    </aside>
  );
}
