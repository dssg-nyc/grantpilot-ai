import { NextResponse } from "next/server";
import { inngest } from "@/inngest/client";
import { embedText } from "@/lib/voyage/embeddings";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function computeProfileCompleteness(org: Record<string, unknown>): number {
  const fields = [
    "legal_name",
    "mission_statement",
    "primary_focus_areas",
    "annual_budget_range",
    "geographic_service_area",
    "org_type",
    "is_501c3",
    "year_founded",
    "website_url",
    "target_beneficiaries",
    "service_states",
    "staff_full_time",
    "years_in_operation",
    "has_received_grants",
    "programs",
    "min_grant_size",
    "preferred_grant_types",
  ];
  const filled = fields.filter((f) => {
    const val = org[f];
    if (val === null || val === undefined) return false;
    if (Array.isArray(val)) return val.length > 0;
    if (typeof val === "string") return val.trim().length > 0;
    return true;
  });
  return Math.round((filled.length / fields.length) * 100);
}

async function buildEmbeddingText(data: Record<string, unknown>) {
  return [
    data.mission_statement,
    `Focus areas: ${(data.primary_focus_areas as string[] ?? []).join(", ")}`,
    `Beneficiaries: ${(data.target_beneficiaries as string[] ?? []).join(", ")}`,
    `Programs: ${(data.programs as Array<{ name: string; description: string }> ?? []).map((p) => `${p.name}: ${p.description}`).join(". ")}`,
    `Budget: ${data.annual_budget_range ?? ""}`,
    `Service area: ${data.geographic_service_area ?? "national"}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: userData } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!userData?.org_id) {
    return NextResponse.json({ organization: null, user: userData, profile_completeness: 0 });
  }

  const { data: org, error } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", userData.org_id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    organization: org,
    user: userData,
    profile_completeness: computeProfileCompleteness(org as Record<string, unknown>),
  });
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let profileEmbedding: number[] | null = null;
  if (body.mission_statement) {
    const text = await buildEmbeddingText(body);
    profileEmbedding = await embedText(text);
  }

  const { id: _id, ...bodyWithoutId } = body as Record<string, unknown> & { id?: unknown };

  // If the user already has an org, re-running onboarding should UPDATE it —
  // not create a duplicate that orphans their existing matches and pipeline.
  const { data: existingUser } = await supabase
    .from("users")
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (existingUser?.org_id) {
    const updateData: Record<string, unknown> = {
      ...bodyWithoutId,
      profile_completeness: computeProfileCompleteness(body),
      updated_at: new Date().toISOString(),
    };
    // Only overwrite the embedding if we recomputed one (mission provided).
    if (profileEmbedding) updateData.profile_embedding = profileEmbedding;

    const { data: org, error } = await supabase
      .from("organizations")
      .update(updateData)
      .eq("id", existingUser.org_id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabase.from("users").update({ onboarding_completed: true }).eq("id", user.id);
    return NextResponse.json({ organization: org }, { status: 200 });
  }

  const orgData = {
    ...bodyWithoutId,
    created_by: user.id,
    profile_embedding: profileEmbedding,
    profile_completeness: computeProfileCompleteness(body),
  };

  const { data: org, error } = await supabase
    .from("organizations")
    .insert(orgData)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Upsert (not update) so the link is established even when the public.users
  // row was never created — e.g. an email-confirmation sign-in that didn't
  // route through /api/auth/callback. Without this the org is orphaned and the
  // dashboard shows "Complete your profile" forever.
  await supabase
    .from("users")
    .upsert(
      { id: user.id, email: user.email ?? "", org_id: org.id, onboarding_completed: true },
      { onConflict: "id" },
    );

  return NextResponse.json({ organization: org }, { status: 201 });
}

export async function PATCH(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { data: userData } = await supabase
    .from("users")
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (!userData?.org_id) {
    return NextResponse.json({ error: "No organization found" }, { status: 404 });
  }

  // Merge the patch over the full existing org so completeness (and the
  // embedding) reflect the whole profile — not just the fields being edited.
  const { data: existing } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", userData.org_id)
    .single();

  const merged = { ...existing, ...body };

  if (body.mission_statement || body.primary_focus_areas) {
    body.profile_embedding = await embedText(await buildEmbeddingText(merged));
  }

  body.profile_completeness = computeProfileCompleteness(merged);
  body.updated_at = new Date().toISOString();

  const { data: org, error } = await supabase
    .from("organizations")
    .update(body)
    .eq("id", userData.org_id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await inngest.send({ name: "org/profile-updated", data: { org_id: userData.org_id } });

  return NextResponse.json({ organization: org });
}
