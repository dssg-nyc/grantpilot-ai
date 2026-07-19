import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { pipelineCreateSchema } from "@/lib/utils/validators";
import { getPlanLimits } from "@/lib/billing/plans";

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

  let rawBody: unknown;
  try { rawBody = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = pipelineCreateSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }
  // Validated + allow-listed: unexpected/forbidden fields are stripped.
  // opportunity_id is intentionally optional here (quick-add flow).
  const body = parsed.data;

  const opportunityId = body.opportunity_id ?? null;

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

  // Free-tier cap on active pipeline items. Only reached when the item above
  // isn't already an idempotent re-add/dedupe of an existing pipeline row.
  const { data: orgRow } = await supabase
    .from("organizations")
    .select("plan")
    .eq("id", orgId)
    .single();
  const limits = getPlanLimits(orgRow?.plan);
  const { count: activeCount } = await supabase
    .from("pipeline_items")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .is("deleted_at", null);
  if ((activeCount ?? 0) >= limits.maxActivePipelineItems) {
    return NextResponse.json(
      {
        error:
          "You've reached the free plan's limit of 5 active pipeline items. Upgrade to Pro for unlimited.",
        code: "plan_limit_pipeline_items",
      },
      { status: 403 },
    );
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
