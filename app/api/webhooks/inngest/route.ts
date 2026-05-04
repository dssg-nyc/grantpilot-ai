import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { syncGrantsGov } from "@/inngest/functions/sync-grants-gov";
import { syncSamGov } from "@/inngest/functions/sync-sam-gov";
import { crawlFoundations } from "@/inngest/functions/crawl-foundations";
import { monitorRss } from "@/inngest/functions/monitor-rss";
import { computeMatchesForNewOpportunities } from "@/inngest/functions/compute-matches";
import { recomputeOrgMatches } from "@/inngest/functions/recompute-org-matches";
import { sendDigestEmails } from "@/inngest/functions/send-digest-emails";
import { updateTrendingScores } from "@/inngest/functions/update-trending-scores";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    syncGrantsGov,
    syncSamGov,
    crawlFoundations,
    monitorRss,
    computeMatchesForNewOpportunities,
    recomputeOrgMatches,
    sendDigestEmails,
    updateTrendingScores,
  ],
});
