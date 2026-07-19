import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitGuard, rateLimiter } from "@/lib/redis/rate-limiter";

export async function POST(request: Request) {
  const rateLimitResponse = await rateLimitGuard(request, "account-delete", rateLimiter);
  if (rateLimitResponse) return rateLimitResponse;

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // From here on, use the service-role client for every read/write — this is a
  // destructive self-service operation and we don't want to depend on RLS.
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("users")
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

  const orgId = profile?.org_id ?? null;

  if (orgId) {
    const { count, error: countError } = await supabaseAdmin
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .neq("id", user.id);

    if (countError) return NextResponse.json({ error: countError.message }, { status: 500 });

    if ((count ?? 0) === 0) {
      const { error: orgDeleteError } = await supabaseAdmin
        .from("organizations")
        .delete()
        .eq("id", orgId);

      if (orgDeleteError) return NextResponse.json({ error: orgDeleteError.message }, { status: 500 });
    }
  }

  const { error: userDeleteError } = await supabaseAdmin
    .from("users")
    .delete()
    .eq("id", user.id);

  if (userDeleteError) return NextResponse.json({ error: userDeleteError.message }, { status: 500 });

  // Delete the Supabase Auth user LAST — this is the point of no return, since it
  // revokes the user's ability to authenticate at all. Every earlier step must
  // have succeeded before we reach this line.
  const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
  if (authDeleteError) return NextResponse.json({ error: authDeleteError.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
