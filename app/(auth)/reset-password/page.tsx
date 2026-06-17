"use client";

import { Suspense, useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function ResetPasswordInner() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  // "request" = ask for email to send a reset link.
  // "update"  = user arrived from the email link, set a new password.
  const [mode, setMode] = useState<"request" | "update">("request");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // The recovery email lands here with a PKCE ?code= — exchange it for a
    // session so the user can set a new password. Also catch the implicit
    // PASSWORD_RECOVERY event for hash-based links.
    const code = params.get("code");
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) setError("This reset link is invalid or has expired. Request a new one below.");
        else setMode("update");
      });
    }
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setMode("update");
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendResetLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) setError(error.message);
    else setNotice("Check your inbox — we sent a password reset link to your email.");
  }

  async function setNewPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords do not match.");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return setError(error.message);
    setNotice("Password updated. Redirecting to your dashboard…");
    setTimeout(() => {
      router.push("/dashboard");
      router.refresh();
    }, 1200);
  }

  if (mode === "update") {
    return (
      <form onSubmit={setNewPassword} className="space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">Set a new password</h1>
        {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {notice && <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</div>}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">New password</label>
          <input
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Confirm password</label>
          <input
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            type="password"
            placeholder="••••••••"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </div>
        <button
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          type="submit"
          disabled={loading}
        >
          {loading ? "Updating…" : "Update password"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={sendResetLink} className="space-y-4">
      <h1 className="text-2xl font-semibold text-gray-900">Reset your password</h1>
      <p className="text-sm text-gray-600">
        Enter your email and we&apos;ll send you a link to reset your password.
      </p>
      {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {notice && <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</div>}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
        <input
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          type="email"
          placeholder="you@organization.org"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <button
        className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        type="submit"
        disabled={loading}
      >
        {loading ? "Sending…" : "Send reset link"}
      </button>
      <p className="text-center text-sm text-gray-600">
        Remembered it?{" "}
        <Link href="/login" className="text-blue-600 hover:underline">
          Back to login
        </Link>
      </p>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Loading…</p>}>
      <ResetPasswordInner />
    </Suspense>
  );
}
