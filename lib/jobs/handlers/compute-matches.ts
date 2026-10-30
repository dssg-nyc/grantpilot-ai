import { supabaseAdmin } from "@/lib/supabase/admin";
import { computeMatchRowsForOrg, saveOrgMatches } from "@/lib/matching/compute";
import type { OrgProfile } from "@/types/profile";
import type { JobHandler } from "@/lib/jobs/handlers/types";

/** "grants/new-opportunities" — recompute matches for every org with an embedding. */
export const computeMatchesForNewOpportunities: JobHandler<"grants/new-opportunities"> = async () => {
  // Fetch all orgs with embeddings
  const { data, error: orgsError } = await supabaseAdmin
    .from("organizations")
    .select("*")
    .not("profile_embedding", "is", null)
    .gte("profile_completeness", 30);
  if (orgsError) throw new Error(`Failed to load orgs: ${orgsError.message}`);
  const orgs = (data ?? []) as (OrgProfile & { id: string })[];

  let totalMatches = 0;
  let totalPruned = 0;
  const failedOrgs: string[] = [];

  // One org failing shouldn't block the rest; keep going, then fail the job at
  // the end so pg-boss retries (the upsert is idempotent, so re-running the
  // orgs that already succeeded is harmless).
  for (const org of orgs) {
    try {
      const matchRows = await computeMatchRowsForOrg(org);
      const { saved, pruned } = await saveOrgMatches(org.id, matchRows);
      totalMatches += saved;
      totalPruned += pruned;
    } catch (e) {
      console.error(`Match compute error for org ${org.id}:`, e);
      failedOrgs.push(org.id);
    }
  }

  if (failedOrgs.length > 0) {
    throw new Error(`Match compute failed for ${failedOrgs.length}/${orgs.length} orgs: ${failedOrgs.slice(0, 5).join(", ")}`);
  }

  return { orgs_processed: orgs.length, total_matches: totalMatches, stale_pruned: totalPruned };
};
