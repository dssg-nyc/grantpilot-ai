"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useProfile } from "@/hooks/useProfile";
import { useBillingUsage, useOpenBillingPortal, useStartCheckout } from "@/hooks/useBilling";
import { useTeam, useRemoveTeamEntry, useAcceptTeamInvite } from "@/hooks/useTeam";
import {
  User, Bell, LogOut, CheckCircle2, Building2, AlertTriangle, CreditCard, Loader2,
  Users, UserPlus, Crown, Mail, X,
} from "lucide-react";
import DeleteAccountModal from "@/components/settings/DeleteAccountModal";
import InviteTeamModal from "@/components/settings/InviteTeamModal";

function UpgradeBanner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  // Derived once at mount via a lazy initializer rather than set from inside
  // an effect — calling setState synchronously in an effect body trips the
  // React Compiler purity rule ("can trigger cascading renders"). The effect
  // below only performs side effects (cache invalidation, stripping the
  // query param), it never calls setState itself.
  const [showUpgraded] = useState(() => searchParams.get("upgraded") === "1");

  useEffect(() => {
    if (!showUpgraded) return;
    queryClient.invalidateQueries({ queryKey: ["billing-usage"] });
    router.replace("/dashboard/settings");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showUpgraded]);

  if (!showUpgraded) return null;

  return (
    <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
      <CheckCircle2 className="h-4 w-4 shrink-0" />
      You&apos;re now on the Pro plan!
    </div>
  );
}

function InviteAcceptBanner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const acceptInvite = useAcceptTeamInvite();
  // Same lazy-initializer pattern as UpgradeBanner above: derive the token
  // once at mount instead of setting state from inside an effect.
  const [token] = useState(() => searchParams.get("invite_token"));

  useEffect(() => {
    if (!token) return;
    acceptInvite.mutate(token, {
      onSettled: () => router.replace("/dashboard/settings"),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (!token) return null;

  if (acceptInvite.isPending) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
        Accepting invite…
      </div>
    );
  }

  if (acceptInvite.isError) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        {acceptInvite.error instanceof Error
          ? acceptInvite.error.message
          : "Failed to accept invite"}
      </div>
    );
  }

  if (acceptInvite.isSuccess) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        Invite accepted — you&apos;ve joined the organization!
      </div>
    );
  }

  return null;
}

function UsageBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const color = pct >= 100 ? "bg-red-500" : pct >= 75 ? "bg-amber-500" : "bg-blue-500";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium text-slate-600">{label}</span>
        <span className="tabular-nums text-slate-400">{value} / {max}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function BillingCard() {
  const { data: usage, isLoading, isError, error } = useBillingUsage();
  const startCheckout = useStartCheckout();
  const openPortal = useOpenBillingPortal();

  function handleUpgrade() {
    startCheckout.mutate(undefined, {
      onSuccess: (data) => {
        window.location.href = data.url;
      },
    });
  }

  function handleManage() {
    openPortal.mutate(undefined, {
      onSuccess: (data) => {
        window.location.href = data.url;
      },
    });
  }

  const isPro = usage?.plan === "pro";

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100">
          <CreditCard className="h-3.5 w-3.5 text-slate-500" />
        </div>
        <h3 className="text-sm font-semibold text-slate-700">Billing</h3>
        {!isLoading && usage && (
          <span
            className={`ml-auto rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
              isPro
                ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                : "bg-slate-100 text-slate-600 border border-slate-200"
            }`}
          >
            {isPro ? "Pro" : "Free"}
          </span>
        )}
      </div>

      <div className="space-y-4 px-5 py-4">
        {isLoading && (
          <p className="text-sm text-slate-400">Loading usage…</p>
        )}

        {isError && (
          <p className="text-sm text-red-600">
            {error instanceof Error ? error.message : "Couldn't load billing usage."}
          </p>
        )}

        {!isLoading && !isError && usage && (
          <>
            {isPro ? (
              <div className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
                <CheckCircle2 className="h-4 w-4" />
                Unlimited matches, pipeline items, and AI drafts
              </div>
            ) : (
              <div className="space-y-3">
                <UsageBar
                  label="Pipeline items"
                  value={usage.usage.activePipelineItems}
                  max={usage.limits.maxActivePipelineItems}
                />
                <UsageBar
                  label="AI drafts this month"
                  value={usage.usage.aiDraftsThisMonth}
                  max={usage.limits.maxAIDraftsPerMonth}
                />
                {usage.usage.totalMatches > usage.limits.maxVisibleMatches ? (
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-600">Matches visible</span>
                    <span className="tabular-nums text-slate-400">
                      {usage.limits.maxVisibleMatches} of {usage.usage.totalMatches} total
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-600">Matches</span>
                    <span className="tabular-nums text-slate-400">{usage.usage.totalMatches} total</span>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {(startCheckout.isError || openPortal.isError) && (
          <p className="text-sm text-red-600">
            {(startCheckout.error as Error | undefined)?.message ??
              (openPortal.error as Error | undefined)?.message}
          </p>
        )}
      </div>

      <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-3.5">
        {isPro ? (
          <button
            onClick={handleManage}
            disabled={openPortal.isPending}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            {openPortal.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {openPortal.isPending ? "Opening…" : "Manage billing"}
          </button>
        ) : (
          <button
            onClick={handleUpgrade}
            disabled={startCheckout.isPending}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
          >
            {startCheckout.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {startCheckout.isPending ? "Starting checkout…" : "Upgrade to Pro — $39/mo"}
          </button>
        )}
      </div>
    </div>
  );
}

function TeamCard() {
  const { data: team, isLoading } = useTeam();
  const removeEntry = useRemoveTeamEntry();
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [pendingRemovalId, setPendingRemovalId] = useState<string | null>(null);

  async function handleRemove(id: string) {
    setPendingRemovalId(id);
    try {
      await removeEntry.mutateAsync(id);
    } finally {
      setPendingRemovalId(null);
    }
  }

  const canManage = !!team && (team.isOwner || team.isAdmin);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100">
          <Users className="h-3.5 w-3.5 text-slate-500" />
        </div>
        <h3 className="text-sm font-semibold text-slate-700">Team</h3>
        {canManage && (
          <button
            onClick={() => setInviteModalOpen(true)}
            className="ml-auto flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Invite teammate
          </button>
        )}
      </div>

      <div className="px-5 py-1">
        {isLoading && <p className="py-3 text-sm text-slate-400">Loading team…</p>}

        {!isLoading && team && (
          <>
            <ul className="divide-y divide-slate-50">
              {team.members.map((member) => (
                <li key={member.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium text-slate-800">
                        {member.email}
                      </span>
                      {member.role === "owner" && (
                        <Crown className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                      )}
                    </div>
                    <span className="text-xs capitalize text-slate-400">{member.role}</span>
                  </div>
                  {canManage && member.role !== "owner" && (
                    <button
                      onClick={() => handleRemove(member.id)}
                      disabled={removeEntry.isPending && pendingRemovalId === member.id}
                      className="shrink-0 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                    >
                      {removeEntry.isPending && pendingRemovalId === member.id
                        ? "Removing…"
                        : "Remove"}
                    </button>
                  )}
                </li>
              ))}
            </ul>

            {team.invites.length > 0 && (
              <>
                <p className="pt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Pending invites
                </p>
                <ul className="divide-y divide-slate-50">
                  {team.invites.map((invite) => (
                    <li key={invite.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <div className="min-w-0">
                          <span className="block truncate text-sm font-medium text-slate-700">
                            {invite.email}
                          </span>
                          <span className="text-xs capitalize text-slate-400">
                            {invite.role} · invited
                          </span>
                        </div>
                      </div>
                      {canManage && (
                        <button
                          onClick={() => handleRemove(invite.id)}
                          disabled={removeEntry.isPending && pendingRemovalId === invite.id}
                          className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                        >
                          <X className="h-3 w-3" />
                          {removeEntry.isPending && pendingRemovalId === invite.id
                            ? "Revoking…"
                            : "Revoke"}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {removeEntry.isError && (
              <p className="py-3 text-sm text-red-600">
                {removeEntry.error instanceof Error
                  ? removeEntry.error.message
                  : "Failed to update team"}
              </p>
            )}
          </>
        )}
      </div>

      <InviteTeamModal open={inviteModalOpen} onClose={() => setInviteModalOpen(false)} />
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { data } = useProfile();
  const user = data?.user;
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
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

      <Suspense fallback={null}>
        <UpgradeBanner />
      </Suspense>

      <Suspense fallback={null}>
        <InviteAcceptBanner />
      </Suspense>

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

      {/* Billing card */}
      <BillingCard />

      {/* Team card */}
      <TeamCard />

      {/* Organization Profile card */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100">
            <Building2 className="h-3.5 w-3.5 text-slate-500" />
          </div>
          <h3 className="text-sm font-semibold text-slate-700">Organization Profile</h3>
        </div>
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <p className="text-sm text-slate-500">
            Update your organization&apos;s mission, focus areas, and other details used for
            matching.
          </p>
          <Link
            href="/dashboard/profile/edit"
            className="flex-shrink-0 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Edit profile
          </Link>
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

      {/* Danger Zone card */}
      <div className="rounded-xl border border-red-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 border-b border-red-100 px-5 py-3.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50">
            <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
          </div>
          <h3 className="text-sm font-semibold text-slate-700">Danger Zone</h3>
        </div>
        <div className="px-5 py-4">
          <p className="mb-3 text-sm text-slate-500">
            Permanently delete your account and all associated data. This cannot be undone.
          </p>
          <button
            onClick={() => setDeleteModalOpen(true)}
            className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
          >
            Delete Account
          </button>
        </div>
      </div>

      <DeleteAccountModal open={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} />
    </div>
  );
}
