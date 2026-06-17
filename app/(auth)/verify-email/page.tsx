"use client";

import { Suspense, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { MailCheck } from "lucide-react";

function VerifyEmailInner() {
  const params = useSearchParams();
  const email = params.get("email") ?? "";
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function resend() {
    if (!email) {
      setError("We don't have your email — please sign up or log in again.");
      return;
    }
    setError(null);
    setNotice(null);
    setLoading(true);
    const { error } = await supabase.auth.resend({ type: "signup", email });
    setLoading(false);
    if (error) setError(error.message);
    else setNotice("Confirmation email resent. Check your inbox.");
  }

  return (
    <div className="space-y-5 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
        <MailCheck className="h-7 w-7 text-blue-600" />
      </div>
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Verify your email</h1>
        <p className="mt-2 text-sm text-gray-600">
          We sent a confirmation link{email ? <> to <span className="font-medium text-gray-900">{email}</span></> : ""}.
          Click it to activate your account, then come back to log in.
        </p>
      </div>

      {notice && <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</div>}
      {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <button
        onClick={resend}
        disabled={loading}
        className="w-full rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        {loading ? "Resending…" : "Resend confirmation email"}
      </button>

      <p className="text-sm text-gray-600">
        Already verified?{" "}
        <Link href="/login" className="text-blue-600 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Loading…</p>}>
      <VerifyEmailInner />
    </Suspense>
  );
}
