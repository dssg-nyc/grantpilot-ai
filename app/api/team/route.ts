import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitGuard, rateLimiter } from "@/lib/redis/rate-limiter";
import { teamInviteSchema } from "@/lib/utils/validators";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://grantpilot.ai";
const FROM = process.env.EMAIL_FROM ?? "hello@grantpilot.ai";

async function getCallerContext() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, orgId: null, orgRole: null as string | null, isOwner: false, isAdmin: false };

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

  const isAdmin = isOwner || userData?.org_role === "admin";
  return { supabase, user, orgId, orgRole: userData?.org_role ?? "member", isOwner, isAdmin };
}

export async function GET() {
  const { supabase, user, orgId, isOwner, isAdmin } = await getCallerContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!orgId) {
    return NextResponse.json({ members: [], invites: [], isOwner: false, isAdmin: false });
  }

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("created_by")
    .eq("id", orgId)
    .single();
  if (orgError) return NextResponse.json({ error: orgError.message }, { status: 500 });

  const { data: members, error: membersError } = await supabase
    .from("users")
    .select("id, email, org_role, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });
  if (membersError) return NextResponse.json({ error: membersError.message }, { status: 500 });

  const { data: invites, error: invitesError } = await supabase
    .from("org_invites")
    .select("id, email, role, status, created_at, expires_at")
    .eq("org_id", orgId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (invitesError) return NextResponse.json({ error: invitesError.message }, { status: 500 });

  // Owner is derived (organizations.created_by), never stored redundantly —
  // see the schema-decision comment at the top of
  // supabase/migrations/014_team_invites.sql.
  const membersWithRole = (members ?? []).map((m) => ({
    ...m,
    role: m.id === org?.created_by ? "owner" : (m.org_role as "admin" | "member"),
  }));

  return NextResponse.json({
    members: membersWithRole,
    invites: invites ?? [],
    isOwner,
    isAdmin,
  });
}

export async function POST(request: Request) {
  const rateLimitResponse = await rateLimitGuard(request, "team-invite", rateLimiter);
  if (rateLimitResponse) return rateLimitResponse;

  const { supabase, user, orgId, isAdmin } = await getCallerContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: "No organization found" }, { status: 404 });
  if (!isAdmin) {
    return NextResponse.json(
      { error: "Only an org owner or admin can invite teammates" },
      { status: 403 },
    );
  }

  let rawBody: unknown;
  try { rawBody = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = teamInviteSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }
  const { email, role } = parsed.data;

  // Already a member of this org? Nothing to invite.
  const { data: existingMember } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("org_id", orgId)
    .ilike("email", email)
    .maybeSingle();
  if (existingMember) {
    return NextResponse.json(
      { error: "That person is already a member of your organization" },
      { status: 409 },
    );
  }

  // Revoke any existing pending invite to the same email first — the partial
  // unique index org_invites_pending_org_email_key (org_id, lower(email))
  // WHERE status='pending' would otherwise reject a re-invite with a 409.
  await supabase
    .from("org_invites")
    .update({ status: "revoked" })
    .eq("org_id", orgId)
    .eq("status", "pending")
    .ilike("email", email);

  const { data: org } = await supabase
    .from("organizations")
    .select("legal_name")
    .eq("id", orgId)
    .single();

  const { data: invite, error } = await supabase
    .from("org_invites")
    .insert({ org_id: orgId, email, role, invited_by: user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const acceptUrl = `${APP_URL}/dashboard/settings?invite_token=${invite.token}`;
  const orgName = org?.legal_name ?? "an organization";

  // Resend is already configured elsewhere (see
  // lib/jobs/handlers/send-digest-emails.ts) — reuse the same render+send
  // pattern. There's no dedicated React Email template for invites yet
  // (emails/ only has WelcomeEmail, AlertEmail, DigestEmail, and adding a new
  // template file is outside this workstream's file scope), so this sends
  // plain HTML directly. TODO: once emails/InviteTeamEmail.tsx exists, swap
  // this for `await resend.emails.send({ ..., html: await render(InviteTeamEmail({...})) })`
  // exactly like send-digest-emails.ts does for DigestEmail.
  if (process.env.RESEND_API_KEY) {
    try {
      await resend.emails.send({
        from: FROM,
        to: email,
        subject: `You've been invited to join ${orgName} on GrantPilot AI`,
        html: `
          <div style="font-family: Arial, sans-serif; color: #334155;">
            <h2 style="color: #002D72;">You've been invited to GrantPilot AI</h2>
            <p>You've been invited to join <strong>${orgName}</strong> as ${role === "admin" ? "an admin" : "a member"}.</p>
            <p>
              <a href="${acceptUrl}" style="background:#F47E2D;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:bold;display:inline-block;">
                Accept invite
              </a>
            </p>
            <p style="color:#94a3b8;font-size:13px;">This invite expires in 7 days. If you weren't expecting this, you can ignore this email.</p>
          </div>
        `,
      });
    } catch {
      // Don't fail the request just because email delivery failed — the
      // invite row already exists and is still acceptable via its token.
    }
  }

  return NextResponse.json(invite, { status: 201 });
}
