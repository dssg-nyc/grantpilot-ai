"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { User, Menu, Settings, LogOut, UserCircle, CalendarClock } from "lucide-react";
import { useUIStore } from "@/store/useUIStore";
import { usePipeline } from "@/hooks/usePipeline";
import { supabaseBrowser } from "@/lib/supabase/client";

const PAGE_TITLES: Record<string, { title: string; description: string }> = {
  "/dashboard":               { title: "Dashboard",     description: "Your funding intelligence overview" },
  "/dashboard/matches":       { title: "My Matches",    description: "AI-curated grants ranked by fit" },
  "/dashboard/opportunities": { title: "Opportunities", description: "Browse and filter all grant opportunities" },
  "/dashboard/pipeline":      { title: "Pipeline",      description: "Track applications from discovery to award" },
  "/dashboard/trending":      { title: "Trending",      description: "Hot grants in your focus areas" },
  "/dashboard/settings":      { title: "Settings",      description: "Manage your account and preferences" },
  "/dashboard/profile":       { title: "Profile",       description: "Your organization profile" },
};

const OPEN_STAGES = new Set(["saved", "researching", "drafting", "submitted"]);

interface DeadlineItem {
  id: string;
  title: string;
  stage: string;
  deadline?: string | null;
  daysLeft: number;
}

function DeadlinesMenu({ onClose }: { onClose: () => void }) {
  const { data } = usePipeline();
  const [now] = useState(() => Date.now());
  const items = useMemo<DeadlineItem[]>(() => {
    const list: { id: string; title: string; stage: string; deadline?: string | null }[] =
      Array.isArray(data) ? data : (data?.items ?? []);
    return list
      .filter((item) => OPEN_STAGES.has(item.stage) && item.deadline)
      .map((item): DeadlineItem => ({
        ...item,
        daysLeft: Math.ceil((new Date(item.deadline as string).getTime() - now) / 86_400_000),
      }))
      .filter((item) => item.daysLeft >= 0 && item.daysLeft <= 30)
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 5);
  }, [data, now]);

  return (
    <>
      <div className="fixed inset-0 z-20" onClick={onClose} />
      <div className="absolute right-0 top-full z-30 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
        <p className="px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Upcoming deadlines
        </p>
        {items.length === 0 ? (
          <p className="px-2.5 py-3 text-sm text-slate-400">No deadlines in the next 30 days.</p>
        ) : (
          <ul className="space-y-0.5">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href="/dashboard/pipeline"
                  onClick={onClose}
                  className="flex items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-sm hover:bg-slate-50"
                >
                  <span className="truncate text-slate-700">{item.title}</span>
                  <span
                    className={`shrink-0 text-xs font-semibold ${
                      item.daysLeft <= 7 ? "text-rose-600" : "text-slate-400"
                    }`}
                  >
                    {item.daysLeft === 0 ? "Today" : `${item.daysLeft}d`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function AccountMenu({ onClose }: { onClose: () => void }) {
  const router = useRouter();

  async function handleSignOut() {
    await supabaseBrowser().auth.signOut();
    onClose();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <div className="fixed inset-0 z-20" onClick={onClose} />
      <div className="absolute right-0 top-full z-30 mt-2 w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
        <Link
          href="/dashboard/profile"
          onClick={onClose}
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          <UserCircle className="h-4 w-4 text-slate-400" />
          Profile
        </Link>
        <Link
          href="/dashboard/settings"
          onClick={onClose}
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          <Settings className="h-4 w-4 text-slate-400" />
          Settings
        </Link>
        <div className="my-1 border-t border-slate-100" />
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </>
  );
}

export default function TopBar() {
  const pathname = usePathname();
  const meta = PAGE_TITLES[pathname] ?? { title: "GrantPilot", description: "" };
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);
  const [bellOpen, setBellOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slate-200 bg-white/80 px-6 py-3.5 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setSidebarOpen(true)}
          aria-label="Open menu"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-sm font-semibold text-slate-900">{meta.title}</h1>
          {meta.description && (
            <p className="text-xs text-slate-400">{meta.description}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Notification bell — upcoming pipeline deadlines */}
        <div className="relative">
          <button
            onClick={() => setBellOpen((v) => !v)}
            aria-label="Upcoming deadlines"
            className="relative flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <CalendarClock className="h-4 w-4" />
          </button>
          {bellOpen && <DeadlinesMenu onClose={() => setBellOpen(false)} />}
        </div>

        {/* Avatar */}
        <div className="relative">
          <button
            onClick={() => setAccountOpen((v) => !v)}
            aria-label="Account menu"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm transition hover:bg-blue-700"
          >
            <User className="h-4 w-4" />
          </button>
          {accountOpen && <AccountMenu onClose={() => setAccountOpen(false)} />}
        </div>
      </div>
    </header>
  );
}
