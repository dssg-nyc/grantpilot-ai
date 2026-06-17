"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import {
  LayoutDashboard,
  Sparkles,
  Search,
  Kanban,
  TrendingUp,
  Settings,
  Landmark,
  ChevronRight,
  X,
} from "lucide-react";
import { useUIStore } from "@/store/useUIStore";

const NAV = [
  { label: "Dashboard",     href: "/dashboard",                icon: LayoutDashboard },
  { label: "My Matches",    href: "/dashboard/matches",        icon: Sparkles },
  { label: "Opportunities", href: "/dashboard/opportunities",  icon: Search },
  { label: "Pipeline",      href: "/dashboard/pipeline",       icon: Kanban },
  { label: "Trending",      href: "/dashboard/trending",       icon: TrendingUp },
  { label: "Settings",      href: "/dashboard/settings",       icon: Settings },
] as const;

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
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
            onClick={onNavigate}
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
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-3 px-5 py-5 border-b border-white/5">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 shadow-lg shadow-blue-600/30">
        <Landmark className="h-4 w-4 text-white" />
      </div>
      <div>
        <p className="text-sm font-bold text-white leading-none">GrantPilot</p>
        <p className="text-[10px] text-slate-400 mt-0.5">AI</p>
      </div>
    </div>
  );
}

function SyncHint() {
  return (
    <div className="m-3 rounded-xl bg-gradient-to-br from-blue-600/20 to-indigo-600/10 border border-blue-500/20 p-4">
      <p className="text-xs font-semibold text-blue-300">Grants updated</p>
      <p className="mt-0.5 text-xs text-slate-400">New opportunities every 4 hours</p>
      <div className="mt-2 flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-[10px] text-emerald-400 font-medium">Live sync active</span>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);

  // Close the mobile drawer on route change.
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname, setSidebarOpen]);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 md:flex flex-col bg-slate-950 border-r border-white/5">
        <Brand />
        <NavLinks />
        <SyncHint />
      </aside>

      {/* Mobile drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-slate-950 border-r border-white/5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/5 pr-3">
              <Brand />
              <button
                onClick={() => setSidebarOpen(false)}
                aria-label="Close menu"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <NavLinks onNavigate={() => setSidebarOpen(false)} />
            <SyncHint />
          </aside>
        </div>
      )}
    </>
  );
}
