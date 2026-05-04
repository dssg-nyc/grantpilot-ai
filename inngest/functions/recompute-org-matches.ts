import { inngest } from "@/inngest/client";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { vectorSimilaritySearch } from "@/lib/matching/vector-search";
import { computeCompositeScore } from "@/lib/matching/score-calculator";
import { batchAnalyzeMatches } from "@/lib/anthropic/match-analyzer";
import type { OrgProfile } from "@/types/profile";
import type { Opportunity } from "@/types/opportunity";

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
      const topOpps = await vectorSimilaritySearch(
        org.profile_embedding as unknown as number[],
        100,
      );

      const scoredOpps = topOpps
        .map(({ opportunity, similarity }) => ({
          opportunity,
          similarity,
          composite_score: computeCompositeScore(org, opportunity, similarity),
        }))
        .filter((o) => o.composite_score >= 25)
        .sort((a, b) => b.composite_score - a.composite_score);

      if (scoredOpps.length === 0) return 0;

      const top20 = scoredOpps.slice(0, 20);
      const analyses = await batchAnalyzeMatches(
        org,
        top20.map((o) => o.opportunity as unknown as Opportunity),
      );

      const matchRows = top20.map(({ opportunity, similarity, composite_score }) => {
        const analysis = analyses.get(opportunity.id);
        return {
          org_id: org.id,
          opportunity_id: opportunity.id,
          raw_similarity_score: similarity,
          match_score: analysis?.match_score ?? composite_score,
          success_probability: analysis?.success_probability ?? 0,
          match_reasons: analysis?.match_reasons ?? [],
          disqualifiers: analysis?.disqualifiers ?? [],
          recommended_action: analysis?.recommended_action ?? null,
          ai_analysis_at: analysis ? new Date().toISOString() : null,
          status: "new",
        };
      });

      await supabaseAdmin
        .from("matches")
        .upsert(matchRows, { onConflict: "org_id,opportunity_id", ignoreDuplicates: false });

      return matchRows.length;
    });

    return { org_id, matches_computed: matchCount };
  },
);
