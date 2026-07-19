import { inngest } from "@/inngest/client";
import { supabaseAdmin } from "@/lib/supabase/admin";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Recency-weighted engagement score. Saves count 3x a view (a save is a much
 * stronger signal of interest than a page view), divided by
 * (days_since_posted + 1) so freshly-posted opportunities with modest
 * engagement can still outrank stale ones that racked up views long ago.
 * The +1 avoids a divide-by-zero for opportunities posted today, and
 * days_since_posted is floored at 0 so a future-dated posted_date can't
 * flip the denominator negative (which would blow the score up instead of
 * decaying it).
 */
function computeTrendingScore(viewCount: number, saveCount: number, daysSincePosted: number): number {
  const engagement = viewCount * 1 + saveCount * 3;
  const days = Math.max(0, daysSincePosted);
  return engagement / (days + 1);
}

export const updateTrendingScores = inngest.createFunction(
  { id: "update-trending-scores", name: "Update Trending Scores", triggers: [{ cron: "0 * * * *" }] },
  async ({ step }) => {
    const opportunities = await step.run("fetch-active-opportunities", async () => {
      const { data, error } = await supabaseAdmin
        .from("opportunities")
        .select("id, view_count, save_count, posted_date, created_at")
        .eq("status", "active");

      if (error) throw error;
      return data ?? [];
    });

    if (!opportunities.length) return { ok: true, updated: 0 };

    const updated = await step.run("recompute-and-store", async () => {
      const now = Date.now();
      let count = 0;

      for (const opp of opportunities) {
        const referenceDate = opp.posted_date ?? opp.created_at;
        const daysSincePosted = referenceDate
          ? (now - new Date(referenceDate).getTime()) / MS_PER_DAY
          : 0;

        const trending_score = computeTrendingScore(
          opp.view_count ?? 0,
          opp.save_count ?? 0,
          daysSincePosted,
        );

        const { error } = await supabaseAdmin
          .from("opportunities")
          .update({ trending_score })
          .eq("id", opp.id);

        if (!error) count++;
      }

      return count;
    });

    return { ok: true, updated };
  },
);
