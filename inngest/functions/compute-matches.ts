import { inngest } from "@/inngest/client";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { computeMatchRowsForOrg } from "@/lib/matching/compute";
import type { OrgProfile } from "@/types/profile";

export const computeMatchesForNewOpportunities = inngest.createFunction(
  {
    id: "compute-matches-new-opps",
    name: "Compute Matches for New Opportunities",
    concurrency: { limit: 1 },
    triggers: [{ event: "grants/new-opportunities" }],
  },
  async ({ step }) => {
    // Fetch all orgs with embeddings
    const orgs = await step.run("get-orgs-with-embeddings", async () => {
      const { data } = await supabaseAdmin
        .from("organizations")
        .select("*")
        .not("profile_embedding", "is", null)
        .gte("profile_completeness", 30);
      return (data ?? []) as OrgProfile[];
    });

    let totalMatches = 0;

    for (const org of orgs) {
      const matchCount = await step.run(`match-org-${org.id}`, async () => {
        const matchRows = await computeMatchRowsForOrg(org as OrgProfile & { id: string });
        if (matchRows.length === 0) return 0;

        const { error } = await supabaseAdmin
          .from("matches")
          .upsert(matchRows, {
            onConflict: "org_id,opportunity_id",
            ignoreDuplicates: false,
          });

        if (error) {
          console.error(`Match upsert error for org ${org.id}:`, error);
        }

        return matchRows.length;
      });

      totalMatches += matchCount;
    }

    return { orgs_processed: orgs.length, total_matches: totalMatches };
  },
);
