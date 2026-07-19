import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { rateLimitGuard, strictRateLimiter } from "@/lib/redis/rate-limiter";

export async function POST(request: Request) {
  const limited = await rateLimitGuard(request, "signup", strictRateLimiter);
  if (limited) return limited;

  let body: { email?: string; password?: string; full_name?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { email, password, full_name } = body;
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const origin = new URL(request.url).origin;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: full_name ?? "" },
      emailRedirectTo: `${origin}/api/auth/callback`,
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (data.user && !data.session) {
    return NextResponse.json({ verifyPending: true });
  }

  if (data.user) {
    await supabase.from("users").upsert({
      id: data.user.id,
      email: data.user.email ?? email,
      role: "org_admin",
      onboarding_completed: false,
    });
  }

  return NextResponse.json({ success: true });
}
