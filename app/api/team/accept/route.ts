import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { teamAcceptSchema } from "@/lib/utils/validators";

// Accepts a pending invite. Deliberately thin: all validation (token exists,
// still pending, not expired, addressed to the caller's own email) and the
// privileged org_id/org_role assignment happen inside the
// accept_org_invite() SECURITY DEFINER function
// (supabase/migrations/014_team_invites.sql) — this route just forwards the
// token under the caller's own authenticated session so auth.uid()/
// auth.email() resolve correctly inside the function.
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let rawBody: unknown;
  try { rawBody = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = teamAcceptSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase.rpc("accept_org_invite", {
    p_token: parsed.data.token,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ org_id: data });
}
