import { supabaseAdmin } from "@/lib/supabase/admin";
import { computeMatchRowsForOrg, saveOrgMatches } from "@/lib/matching/compute";
import type { OrgProfile } from "@/types/profile";
import type { JobHandler } from "@/lib/jobs/handlers/types";

/** "org/profile-updated" — recompute one org's matches after a profile change. */
export const recomputeOrgMatches: JobHandler<"org/profile-updated"> = async ({ org_id }) => {
  if (!org_id) return { skipped: true, reason: "No org_id in payload" };

  const { data, error: orgError } = await supabaseAdmin
    .from("organizations")
    .select("*")
    .eq("id", org_id)
    .maybeSingle();
  if (orgError) throw new Error(`Failed to load org ${org_id}: ${orgError.message}`);
  const org = data as (OrgProfile & { id: string }) | null;

  if (!org || !org.profile_embedding) {
    return { skipped: true, reason: "No org or embedding" };
  }

  const matchRows = await computeMatchRowsForOrg(org);
  const { saved, pruned } = await saveOrgMatches(org_id, matchRows);
  return { org_id, matches_computed: saved, stale_pruned: pruned };
};
