import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function getOrgId() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, orgId: null };
  const { data } = await supabase.from("users").select("org_id").eq("id", user.id).single();
  return { supabase, orgId: data?.org_id ?? null };
}

const ALLOWED_STATUS = ["new", "saved", "applied", "dismissed"];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { supabase, orgId } = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.status === "string") {
    if (!ALLOWED_STATUS.includes(body.status)) {
      return NextResponse.json({ error: `Invalid status. Allowed: ${ALLOWED_STATUS.join(", ")}` }, { status: 400 });
    }
    update.status = body.status;
  }
  if (typeof body.user_notes === "string") update.user_notes = body.user_notes;

  const { data, error } = await supabase
    .from("matches")
    .update(update)
    .eq("id", id)
    .eq("org_id", orgId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
