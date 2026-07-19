import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function getCaller() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, orgId: null };
  // maybeSingle, not single: a brand-new/unconfirmed-onboarding account can
  // legitimately have zero public.users rows yet — that's "no org", not an
  // auth failure, and .single() would throw PGRST116 and get misread as one.
  const { data } = await supabase.from("users").select("org_id").eq("id", user.id).maybeSingle();
  return { supabase, user, orgId: data?.org_id ?? null };
}

export async function GET() {
  const { supabase, user, orgId } = await getCaller();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!orgId) {
    return NextResponse.json(
      { error: "Complete your organization profile first.", code: "no_org" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("chat_conversations")
    .select("id, title, pipeline_item_id, created_at, updated_at")
    .eq("org_id", orgId)
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ conversations: data ?? [] });
}

export async function POST(request: Request) {
  const { supabase, user, orgId } = await getCaller();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!orgId) {
    return NextResponse.json(
      { error: "Complete your organization profile first.", code: "no_org" },
      { status: 400 },
    );
  }

  let body: { pipeline_item_id?: string; title?: string } = {};
  try {
    body = await request.json();
  } catch {
    // empty body is fine — a bare "new conversation" is the default case
  }

  const { data, error } = await supabase
    .from("chat_conversations")
    .insert({
      org_id: orgId,
      user_id: user.id,
      pipeline_item_id: body.pipeline_item_id ?? null,
      title: body.title?.trim() || "New conversation",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ conversation: data }, { status: 201 });
}
