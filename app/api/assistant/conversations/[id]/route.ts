import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function getCaller() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, orgId: null };
  const { data } = await supabase.from("users").select("org_id").eq("id", user.id).maybeSingle();
  return { supabase, user, orgId: data?.org_id ?? null };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { supabase, user, orgId } = await getCaller();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!orgId) {
    return NextResponse.json(
      { error: "Complete your organization profile first.", code: "no_org" },
      { status: 400 },
    );
  }

  const { data: conversation, error: convError } = await supabase
    .from("chat_conversations")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (convError) return NextResponse.json({ error: convError.message }, { status: 500 });
  if (!conversation) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

  const { data: messages, error: msgError } = await supabase
    .from("chat_messages")
    .select("id, role, content, tool_calls, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });
  if (msgError) return NextResponse.json({ error: msgError.message }, { status: 500 });

  return NextResponse.json({ conversation, messages: messages ?? [] });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { supabase, user, orgId } = await getCaller();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!orgId) {
    return NextResponse.json(
      { error: "Complete your organization profile first.", code: "no_org" },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("chat_conversations")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
