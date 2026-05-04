"use client";

import { usePathname } from "next/navigation";
import { Bell, User } from "lucide-react";

const PAGE_TITLES: Record<string, { title: string; description: string }> = {
  "/dashboard":               { title: "Dashboard",     description: "Your funding intelligence overview" },
  "/dashboard/matches":       { title: "My Matches",    description: "AI-curated grants ranked by fit" },
  "/dashboard/opportunities": { title: "Opportunities", description: "Browse and filter all grant opportunities" },
  "/dashboard/pipeline":      { title: "Pipeline",      description: "Track applications from discovery to award" },
  "/dashboard/trending":      { title: "Trending",      description: "Hot grants in your focus areas" },
  "/dashboard/settings":      { title: "Settings",      description: "Manage your account and preferences" },
  "/dashboard/profile":       { title: "Profile",       description: "Your organization profile" },
};

export default function TopBar() {
  const pathname = usePathname();
  const meta = PAGE_TITLES[pathname] ?? { title: "GrantPilot", description: "" };

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slate-200 bg-white/80 px-6 py-3.5 backdrop-blur-sm">
      <div>
        <h1 className="text-sm font-semibold text-slate-900">{meta.title}</h1>
        {meta.description && (
          <p className="text-xs text-slate-400">{meta.description}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Notification bell */}
        <button className="relative flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-blue-500" />
        </button>

        {/* Avatar */}
        <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm transition hover:bg-blue-700">
          <User className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
