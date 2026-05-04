import { inngest } from "@/inngest/client";

export const updateTrendingScores = inngest.createFunction(
  { id: "update-trending-scores", name: "Update Trending Scores", triggers: [{ cron: "0 * * * *" }] },
  async () => ({ ok: true }),
);
