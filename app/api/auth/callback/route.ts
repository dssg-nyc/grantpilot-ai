import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("Auth callback error:", error.message);
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  if (data.user) {
    const { data: existingUser } = await supabase
      .from("users")
      .select("id, onboarding_completed, org_id")
      .eq("id", data.user.id)
      .single();

    if (!existingUser) {
      await supabase.from("users").insert({
        id: data.user.id,
        email: data.user.email ?? "",
        role: "org_admin",
        onboarding_completed: false,
      });
      return NextResponse.redirect(`${origin}/onboarding`);
    }

    if (!existingUser.onboarding_completed || !existingUser.org_id) {
      return NextResponse.redirect(`${origin}/onboarding`);
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
