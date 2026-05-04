import { inngest } from "@/inngest/client";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { vectorSimilaritySearch } from "@/lib/matching/vector-search";
import { computeCompositeScore } from "@/lib/matching/score-calculator";
import { batchAnalyzeMatches } from "@/lib/anthropic/match-analyzer";
import type { OrgProfile } from "@/types/profile";
import type { Opportunity } from "@/types/opportunity";

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
        // Vector similarity search for this org
        const topOpps = await vectorSimilaritySearch(
          org.profile_embedding as unknown as number[],
          100,
        );

        // Compute composite scores and filter low-quality
        const scoredOpps = topOpps
          .map(({ opportunity, similarity }) => ({
            opportunity,
            similarity,
            composite_score: computeCompositeScore(org, opportunity, similarity),
          }))
          .filter((o) => o.composite_score >= 25)
          .sort((a, b) => b.composite_score - a.composite_score);

        if (scoredOpps.length === 0) return 0;

        // Deep AI analysis on top 20
        const top20 = scoredOpps.slice(0, 20);
        const analyses = await batchAnalyzeMatches(
          org,
          top20.map((o) => o.opportunity as unknown as Opportunity),
        );

        // Upsert matches
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
