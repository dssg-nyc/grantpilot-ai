import { createSupabaseServerClient } from "@/lib/supabase/server";
import { rateLimitGuard, strictRateLimiter } from "@/lib/redis/rate-limiter";
import { runScout, type ScoutEvent } from "@/lib/anthropic/scout/run-scout";
import { buildScoutSystemPrompt } from "@/lib/anthropic/scout/system-prompt";
import { SCOUT_FUNDER_TYPES, type ScoutFunderType, type ScoutRequest } from "@/types/scout";
import type { OrgProfile } from "@/types/profile";

/**
 * A real research run makes ~10 web searches and ~10 page fetches at high
 * effort, which routinely takes several minutes. If a proxy or client cuts
 * the stream short, that is survivable by design: every finding is persisted the instant
 * the agent records it, and the client refetches the run from the database
 * when the stream ends, so a truncated run still shows everything found.
 */
export const maxDuration = 300;

const FUNDER_TYPE_SET = new Set<string>(SCOUT_FUNDER_TYPES);

function sseLine(event: ScoutEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function parseRequest(body: Record<string, unknown>): ScoutRequest | { error: string } {
  const scope = body.scope === "project" ? "project" : "organization";

  const projectName = typeof body.project_name === "string" ? body.project_name.trim() : "";
  const projectDescription =
    typeof body.project_description === "string" ? body.project_description.trim() : "";

  if (scope === "project" && !projectName && !projectDescription) {
    return { error: "Describe the project you want funding for, or switch the scope to your whole organization." };
  }
  if (projectDescription.length > 4000) {
    return { error: "Project description is too long (max 4000 characters)." };
  }

  const numOrNull = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;

  const funderTypes = Array.isArray(body.funder_types)
    ? (body.funder_types.filter((t): t is ScoutFunderType => typeof t === "string" && FUNDER_TYPE_SET.has(t)))
    : [];

  const rawTarget = typeof body.target_count === "number" ? Math.round(body.target_count) : 8;

  return {
    scope,
    project_name: projectName.slice(0, 200) || undefined,
    project_description: projectDescription || undefined,
    funding_need_min: numOrNull(body.funding_need_min),
    funding_need_max: numOrNull(body.funding_need_max),
    geographic_focus:
      typeof body.geographic_focus === "string" ? body.geographic_focus.trim().slice(0, 200) || undefined : undefined,
    funder_types: funderTypes,
    target_count: Math.max(1, Math.min(20, rawTarget)),
  };
}

export async function POST(request: Request) {
  const limited = await rateLimitGuard(request, "scout-run", strictRateLimiter);
  if (limited) return limited;

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "Unauthorized" }, 401);

  const { data: userRow } = await supabase.from("users").select("org_id").eq("id", user.id).maybeSingle();
  const orgId = userRow?.org_id ?? null;
  if (!orgId) return json({ error: "Complete your organization profile first." }, 400);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const parsed = parseRequest(body);
  if ("error" in parsed) return json({ error: parsed.error }, 400);

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", orgId)
    .single();
  if (orgError || !org) return json({ error: "Organization not found" }, 404);

  // The scout scores fit against the org profile, so a near-empty profile
  // produces near-useless results. Fail loudly rather than burning a run.
  if (!org.mission_statement && !(org.primary_focus_areas ?? []).length) {
    return json(
      { error: "Add your mission statement and focus areas to your profile first — the scout scores fit against them." },
      400,
    );
  }

  const { data: run, error: runError } = await supabase
    .from("scout_runs")
    .insert({
      org_id: orgId,
      user_id: user.id,
      scope: parsed.scope,
      project_name: parsed.project_name ?? null,
      project_description: parsed.project_description ?? null,
      funding_need_min: parsed.funding_need_min,
      funding_need_max: parsed.funding_need_max,
      geographic_focus: parsed.geographic_focus ?? null,
      funder_types: parsed.funder_types ?? [],
      target_count: parsed.target_count ?? 8,
      status: "running",
    })
    .select()
    .single();
  if (runError || !run) return json({ error: runError?.message ?? "Failed to start the run" }, 500);

  const systemPrompt = buildScoutSystemPrompt(org as OrgProfile, parsed);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let clientGone = false;
      const send = (event: ScoutEvent) => {
        if (clientGone) return;
        try {
          controller.enqueue(encoder.encode(sseLine(event)));
        } catch {
          // The user navigated away. Keep the run going so their findings
          // still land in the database, just stop trying to write to a
          // closed socket.
          clientGone = true;
        }
      };

      // Tell the client its run id first, so it can poll or reopen the run
      // even if everything after this point fails.
      send({ type: "activity", label: "Starting research run", detail: run.id });

      let summary = "";
      let findingCount = 0;
      let searchesUsed = 0;
      let failure: string | null = null;

      try {
        for await (const event of runScout(systemPrompt, { supabase, runId: run.id, orgId })) {
          send(event);
          if (event.type === "done") {
            summary = event.summary;
            findingCount = event.findingCount;
            searchesUsed = event.searchesUsed;
          } else if (event.type === "error") {
            failure = event.message;
          }
        }
      } catch (err) {
        failure = err instanceof Error ? err.message : "The research run was interrupted.";
        send({ type: "error", message: failure });
      }

      // Findings were written as they were found, so recount from the table
      // rather than trusting the in-memory tally — it stays correct even when
      // the loop exits early.
      const { count } = await supabase
        .from("scout_findings")
        .select("id", { count: "exact", head: true })
        .eq("run_id", run.id);

      await supabase
        .from("scout_runs")
        .update({
          status: failure ? "failed" : "completed",
          summary: summary.trim() || null,
          error: failure,
          finding_count: count ?? findingCount,
          searches_used: searchesUsed,
          completed_at: new Date().toISOString(),
        })
        .eq("id", run.id);

      try {
        controller.close();
      } catch {
        // Already closed by the client disconnecting.
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Scout-Run-Id": run.id,
    },
  });
}
