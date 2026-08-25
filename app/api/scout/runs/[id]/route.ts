import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function getCaller() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, orgId: null };
  const { data } = await supabase.from("users").select("org_id").eq("id", user.id).maybeSingle();
  return { supabase, user, orgId: data?.org_id ?? null };
}

/**
 * The structured result of one research run: the run's parameters and every
 * opportunity it found, ranked by fit, each with the source URL it came from.
 * This is the machine-readable form of what the Scout page renders.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { supabase, user, orgId } = await getCaller();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: "No organization on file" }, { status: 400 });

  const { data: run, error: runError } = await supabase
    .from("scout_runs")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (runError) return NextResponse.json({ error: runError.message }, { status: 500 });
  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });

  const { data: findings, error: findingsError } = await supabase
    .from("scout_findings")
    .select("*")
    .eq("run_id", id)
    .order("fit_score", { ascending: false })
    .order("created_at", { ascending: true });
  if (findingsError) return NextResponse.json({ error: findingsError.message }, { status: 500 });

  return NextResponse.json({ run: { ...run, findings: findings ?? [] } });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { supabase, user, orgId } = await getCaller();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: "No organization on file" }, { status: 400 });

  // Findings cascade with the run.
  const { error } = await supabase.from("scout_runs").delete().eq("id", id).eq("org_id", orgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
