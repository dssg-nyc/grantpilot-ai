import { inngest } from "@/inngest/client";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { computeMatchRowsForOrg } from "@/lib/matching/compute";
import type { OrgProfile } from "@/types/profile";

export const recomputeOrgMatches = inngest.createFunction(
  {
    id: "recompute-org-matches",
    name: "Recompute Org Matches on Profile Update",
    concurrency: { limit: 3 },
    triggers: [{ event: "org/profile-updated" }],
  },
  async ({ event, step }) => {
    const { org_id } = event.data as { org_id: string };

    const org = await step.run("get-org", async () => {
      const { data } = await supabaseAdmin
        .from("organizations")
        .select("*")
        .eq("id", org_id)
        .single();
      return data as OrgProfile | null;
    });

    if (!org || !org.profile_embedding) {
      return { skipped: true, reason: "No org or embedding" };
    }

    const matchCount = await step.run("compute-matches", async () => {
      const matchRows = await computeMatchRowsForOrg(org as OrgProfile & { id: string });
      if (matchRows.length === 0) return 0;

      await supabaseAdmin
        .from("matches")
        .upsert(matchRows, { onConflict: "org_id,opportunity_id", ignoreDuplicates: false });

      return matchRows.length;
    });

    return { org_id, matches_computed: matchCount };
  },
);
