import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function getOrgId() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, orgId: null };
  const { data } = await supabase.from("users").select("org_id").eq("id", user.id).single();
  return { supabase, orgId: data?.org_id ?? null };
}

export async function GET() {
  const { supabase, orgId } = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Unauthorized or no org" }, { status: 401 });

  const { data, error } = await supabase
    .from("pipeline_items")
    .select("*, opportunity:opportunities(*)")
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const { supabase, orgId } = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Unauthorized or no org" }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const opportunityId = typeof body.opportunity_id === "string" ? body.opportunity_id : null;

  // Idempotent: a grant can only be in the org's active pipeline once.
  if (opportunityId) {
    const { data: existing } = await supabase
      .from("pipeline_items")
      .select("*")
      .eq("org_id", orgId)
      .eq("opportunity_id", opportunityId)
      .is("deleted_at", null)
      .maybeSingle();
    if (existing) return NextResponse.json(existing, { status: 200 });
  }

  const { data, error } = await supabase
    .from("pipeline_items")
    .insert({ ...body, org_id: orgId })
    .select()
    .single();

  if (error) {
    // Lost a race against the unique index — return the existing row instead of erroring.
    if (error.code === "23505" && opportunityId) {
      const { data: existing } = await supabase
        .from("pipeline_items")
        .select("*")
        .eq("org_id", orgId)
        .eq("opportunity_id", opportunityId)
        .is("deleted_at", null)
        .maybeSingle();
      if (existing) return NextResponse.json(existing, { status: 200 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
