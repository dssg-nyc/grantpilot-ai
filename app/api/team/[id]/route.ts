import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

async function getCallerContext() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, orgId: null, isAdmin: false };

  const { data: userData } = await supabase
    .from("users")
    .select("org_id, org_role")
    .eq("id", user.id)
    .single();

  const orgId: string | null = userData?.org_id ?? null;
  let isOwner = false;

  if (orgId) {
    const { data: org } = await supabase
      .from("organizations")
      .select("created_by")
      .eq("id", orgId)
      .single();
    isOwner = org?.created_by === user.id;
  }

  return { supabase, user, orgId, isAdmin: isOwner || userData?.org_role === "admin" };
}

// Removes a member or revokes a pending invite — [id] may be either a
// public.users.id or a public.org_invites.id, disambiguated by which table
// actually has a matching row for this org. Only an org owner/admin may call
// this.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { supabase, user, orgId, isAdmin } = await getCallerContext();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: "No organization found" }, { status: 404 });
  if (!isAdmin) {
    return NextResponse.json(
      { error: "Only an org owner or admin can manage the team" },
      { status: 403 },
    );
  }

  // Case 1: a pending invite.
  const { data: invite } = await supabase
    .from("org_invites")
    .select("id")
    .eq("id", id)
    .eq("org_id", orgId)
    .eq("status", "pending")
    .maybeSingle();

  if (invite) {
    const { error } = await supabase
      .from("org_invites")
      .update({ status: "revoked" })
      .eq("id", id)
      .eq("org_id", orgId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // Case 2: a member. The owner (organizations.created_by) can never be
  // removed via this route, and a caller can't remove themselves here either
  // (that's account deletion, a separate destructive flow).
  const { data: org } = await supabase
    .from("organizations")
    .select("created_by")
    .eq("id", orgId)
    .single();

  if (org?.created_by === id) {
    return NextResponse.json({ error: "The org owner can't be removed" }, { status: 400 });
  }
  if (id === user.id) {
    return NextResponse.json(
      { error: "You can't remove yourself here — use account settings instead" },
      { status: 400 },
    );
  }

  const { data: target } = await supabaseAdmin
    .from("users")
    .select("id, org_id")
    .eq("id", id)
    .maybeSingle();

  if (!target || target.org_id !== orgId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { count } = await supabaseAdmin
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId);

  if ((count ?? 0) <= 1) {
    return NextResponse.json(
      { error: "Can't remove the last remaining member of an organization" },
      { status: 400 },
    );
  }

  // Service-role client: bypasses RLS and satisfies the self-escalation
  // trigger's `auth.role() = 'service_role'` exemption
  // (012_prevent_users_self_escalation.sql), the same pattern
  // app/api/account/delete/route.ts already uses for cross-user writes that
  // shouldn't depend on RLS.
  const { error } = await supabaseAdmin
    .from("users")
    .update({ org_id: null, org_role: "member" })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
