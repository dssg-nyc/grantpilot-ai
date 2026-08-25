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
  Bot,
  Radar,
} from "lucide-react";
import { useUIStore } from "@/store/useUIStore";

const NAV = [
  { label: "Dashboard",     href: "/dashboard",                icon: LayoutDashboard },
  { label: "AI Assistant",  href: "/dashboard/assistant",      icon: Bot },
  { label: "Funding Scout", href: "/dashboard/scout",          icon: Radar },
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
      <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
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
                ? "bg-blue-50 text-blue-700"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
            }`}
          >
            <Icon className={`h-4 w-4 shrink-0 ${active ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600"}`} />
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
    <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-100">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-700 to-blue-900 shadow-sm">
        <Landmark className="h-4 w-4 text-white" />
      </div>
      <div>
        <p className="text-sm font-bold text-slate-900 leading-none">GrantPilot AI</p>
        <p className="text-[10px] text-slate-400 mt-0.5">by DSSG NYC</p>
      </div>
    </div>
  );
}

function SyncHint() {
  return (
    <div className="m-3 rounded-xl bg-blue-50 border border-blue-100 p-4">
      <p className="text-xs font-semibold text-blue-700">Grants updated</p>
      <p className="mt-0.5 text-xs text-slate-500">New opportunities every 4 hours</p>
      <div className="mt-2 flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-[10px] text-emerald-700 font-medium">Live sync active</span>
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
      <aside className="hidden w-64 shrink-0 md:flex flex-col bg-white border-r border-slate-100">
        <Brand />
        <NavLinks />
        <SyncHint />
      </aside>

      {/* Mobile drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-white border-r border-slate-100 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pr-3">
              <Brand />
              <button
                onClick={() => setSidebarOpen(false)}
                aria-label="Close menu"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-700"
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
