import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { GRANT_SECTION_KEYS } from "@/lib/utils/grant-sections";

async function getCaller() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, orgId: null };
  const { data } = await supabase.from("users").select("org_id").eq("id", user.id).maybeSingle();
  return { supabase, orgId: data?.org_id ?? null };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { supabase, orgId } = await getCaller();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: item, error: itemError } = await supabase
    .from("pipeline_items")
    .select("id")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (itemError) return NextResponse.json({ error: itemError.message }, { status: 500 });
  if (!item) return NextResponse.json({ error: "Pipeline item not found" }, { status: 404 });

  const { data: sections, error } = await supabase
    .from("grant_drafts")
    .select("section_key, content, status, updated_at")
    .eq("pipeline_item_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ sections: sections ?? [] });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { supabase, orgId } = await getCaller();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { section_key?: string; content?: string; status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sectionKey = body.section_key;
  if (!sectionKey || !GRANT_SECTION_KEYS.includes(sectionKey as (typeof GRANT_SECTION_KEYS)[number])) {
    return NextResponse.json({ error: "Invalid section_key" }, { status: 400 });
  }
  if (typeof body.content !== "string") {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }
  if (body.status && !["draft", "reviewed"].includes(body.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const { data: item, error: itemError } = await supabase
    .from("pipeline_items")
    .select("id")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (itemError) return NextResponse.json({ error: itemError.message }, { status: 500 });
  if (!item) return NextResponse.json({ error: "Pipeline item not found" }, { status: 404 });

  const { data, error } = await supabase
    .from("grant_drafts")
    .upsert(
      {
        org_id: orgId,
        pipeline_item_id: id,
        section_key: sectionKey,
        content: body.content,
        status: body.status ?? "draft",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "pipeline_item_id,section_key" },
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ section: data });
}
