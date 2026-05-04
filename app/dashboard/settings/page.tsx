"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { useProfile } from "@/hooks/useProfile";
import { User, Bell, LogOut, CheckCircle2 } from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const { data } = useProfile();
  const user = data?.user;
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [threshold, setThreshold] = useState(
    data?.organization?.match_score_threshold ?? 60,
  );
  const [notifFreq, setNotifFreq] = useState(
    data?.organization?.notification_frequency ?? "weekly",
  );

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  async function handleSaveNotifications(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        match_score_threshold: threshold,
        notification_frequency: notifFreq,
      }),
    });
    setSaved(true);
    setSaving(false);
    setTimeout(() => setSaved(false), 3000);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const scoreColor =
    threshold >= 70 ? "text-emerald-600" :
    threshold >= 50 ? "text-blue-600"    : "text-amber-600";

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900">Settings</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Manage your account and notification preferences
        </p>
      </div>

      {/* Account card */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100">
            <User className="h-3.5 w-3.5 text-slate-500" />
          </div>
          <h3 className="text-sm font-semibold text-slate-700">Account</h3>
        </div>
        <div className="divide-y divide-slate-50 px-5 py-1">
          <div className="flex items-center justify-between py-3">
            <span className="text-sm text-slate-500">Email</span>
            <span className="text-sm font-medium text-slate-800">{user?.email ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between py-3">
            <span className="text-sm text-slate-500">Role</span>
            <span className="text-sm font-medium capitalize text-slate-800">
              {user?.role?.replace("_", " ") ?? "—"}
            </span>
          </div>
        </div>
        <div className="border-t border-slate-100 px-5 py-3.5">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      </div>

      {/* Notifications card */}
      <form
        onSubmit={handleSaveNotifications}
        className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"
      >
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50">
            <Bell className="h-3.5 w-3.5 text-blue-500" />
          </div>
          <h3 className="text-sm font-semibold text-slate-700">Notifications</h3>
        </div>

        <div className="space-y-5 px-5 py-5">
          {/* Frequency */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Email digest frequency
            </label>
            <select
              value={notifFreq}
              onChange={(e) => setNotifFreq(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly (Monday)</option>
              <option value="never">Never</option>
            </select>
          </div>

          {/* Match threshold */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">
                Alert for matches above
              </label>
              <span className={`text-sm font-bold ${scoreColor}`}>{threshold}%</span>
            </div>
            <input
              type="range"
              min={30}
              max={90}
              step={5}
              value={threshold}
              onChange={(e) => setThreshold(parseInt(e.target.value))}
              className="w-full accent-blue-600"
            />
            <div className="mt-1 flex justify-between text-xs text-slate-400">
              <span>30% — broad</span>
              <span>90% — strict</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-slate-100 bg-slate-50/50 px-5 py-3.5">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save preferences"}
          </button>
          {saved && (
            <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-600">
              <CheckCircle2 className="h-4 w-4" /> Saved
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
