import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { rateLimitGuard, strictRateLimiter } from "@/lib/redis/rate-limiter";
import { generateDraftAssistance } from "@/lib/anthropic/draft-generator";
import { getPlanLimits } from "@/lib/billing/plans";
import type { PipelineItem } from "@/types/pipeline";
import type { Opportunity } from "@/types/opportunity";
import type { OrgProfile } from "@/types/profile";

async function getOrgId() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, orgId: null };
  const { data } = await supabase.from("users").select("org_id").eq("id", user.id).single();
  return { supabase, orgId: data?.org_id ?? null };
}

function startOfCurrentMonthISO(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // This endpoint calls Claude — rate limit hard, same as other AI routes.
  const limited = await rateLimitGuard(request, "draft-generate", strictRateLimiter);
  if (limited) return limited;

  const { id } = await params;
  const { supabase, orgId } = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: pipelineItem, error: pipelineError } = await supabase
    .from("pipeline_items")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .single();

  if (pipelineError || !pipelineItem) {
    return NextResponse.json({ error: "Pipeline item not found" }, { status: 404 });
  }

  const item = pipelineItem as PipelineItem;

  if (!item.opportunity_id) {
    return NextResponse.json(
      {
        error:
          "This pipeline item isn't linked to a grant listing, so there's nothing to draft against. Use a grant from your matches or opportunities instead.",
      },
      { status: 400 },
    );
  }

  const { data: orgRow, error: orgError } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", orgId)
    .single();

  if (orgError || !orgRow) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const { data: opportunityRow, error: opportunityError } = await supabase
    .from("opportunities")
    .select("*")
    .eq("id", item.opportunity_id)
    .single();

  if (opportunityError || !opportunityRow) {
    return NextResponse.json({ error: "Linked grant opportunity not found" }, { status: 404 });
  }

  const org = orgRow as OrgProfile & { plan?: string | null };
  const opportunity = opportunityRow as Opportunity;

  const limits = getPlanLimits(org.plan);

  const { count, error: countError } = await supabase
    .from("draft_generations")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .gte("created_at", startOfCurrentMonthISO());

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }

  const usedThisMonth = count ?? 0;

  if (usedThisMonth >= limits.maxAIDraftsPerMonth) {
    return NextResponse.json(
      {
        error: `You've used all ${limits.maxAIDraftsPerMonth} AI drafts this month on the free plan. Upgrade to Pro for unlimited.`,
        code: "plan_limit_drafts",
      },
      { status: 403 },
    );
  }

  const draft = await generateDraftAssistance(org, opportunity, item.notes);
  if (!draft) {
    return NextResponse.json(
      { error: "Couldn't generate draft assistance right now — try again." },
      { status: 502 },
    );
  }

  const { error: insertError } = await supabase.from("draft_generations").insert({
    org_id: orgId,
    pipeline_item_id: id,
    content: draft,
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const newCount = usedThisMonth + 1;
  const draftsRemaining =
    limits.maxAIDraftsPerMonth === Infinity ? null : Math.max(0, limits.maxAIDraftsPerMonth - newCount);

  return NextResponse.json({ draft, drafts_remaining_this_month: draftsRemaining });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { supabase, orgId } = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: pipelineItem, error: pipelineError } = await supabase
    .from("pipeline_items")
    .select("id")
    .eq("id", id)
    .eq("org_id", orgId)
    .single();

  if (pipelineError || !pipelineItem) {
    return NextResponse.json({ error: "Pipeline item not found" }, { status: 404 });
  }

  const { data: latest, error: latestError } = await supabase
    .from("draft_generations")
    .select("content")
    .eq("pipeline_item_id", id)
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) {
    return NextResponse.json({ error: latestError.message }, { status: 500 });
  }

  return NextResponse.json({ draft: latest?.content ?? null });
}
