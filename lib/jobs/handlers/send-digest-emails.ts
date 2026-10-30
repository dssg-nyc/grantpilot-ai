import { supabaseAdmin } from "@/lib/supabase/admin";
import { render } from "@react-email/render";
import { Resend } from "resend";
import DigestEmail from "@/emails/DigestEmail";
import type { JobHandler } from "@/lib/jobs/handlers/types";

const resend = new Resend(process.env.RESEND_API_KEY);
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://grantpilot.ai";
const FROM = process.env.EMAIL_FROM ?? "hello@grantpilot.ai";

/** "send-digest-emails" — weekly top-matches digest for opted-in users. */
export const sendDigestEmails: JobHandler<"send-digest-emails"> = async () => {
  // Get orgs with weekly digest preference. (users has no name column in any
  // migration — selecting the old `full_name` made this query error, which
  // the Inngest version swallowed, so no digest was ever sent.) Throwing here
  // (before any email goes out) is the only failure that triggers a pg-boss
  // retry, so a retry can never double-send.
  const { data, error } = await supabaseAdmin
    .from("alert_configs")
    .select(`
      user_id,
      org_id,
      users!inner(email),
      organizations!inner(legal_name)
    `)
    .eq("digest_frequency", "weekly")
    .eq("email_enabled", true);
  if (error) throw new Error(`Failed to load digest subscribers: ${error.message}`);
  const subscribers = data ?? [];

  let sent = 0;
  let failed = 0;

  for (const sub of subscribers) {
    try {
      // Get top 5 new matches since last week
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const { data: matches } = await supabaseAdmin
        .from("matches")
        .select("match_score, opportunities(title, funder_name, deadline, source_url)")
        .eq("org_id", sub.org_id)
        .gte("created_at", oneWeekAgo.toISOString())
        .gte("match_score", 50)
        .order("match_score", { ascending: false })
        .limit(5);

      type OppRow = { title: string; funder_name: string; deadline: string | null; source_url: string } | null;
      const formattedMatches = (matches ?? []).map((m) => {
        const opp = m.opportunities as unknown as OppRow;
        return {
          title: opp?.title ?? "Opportunity",
          funderName: opp?.funder_name ?? "",
          matchScore: m.match_score,
          deadline: opp?.deadline ?? undefined,
          url: `${APP_URL}/dashboard/opportunities`,
        };
      });

      const user = sub.users as unknown as { email: string };
      const org = sub.organizations as unknown as { legal_name: string };

      const html = await render(
        DigestEmail({
          userName: "there",
          orgName: org.legal_name,
          matches: formattedMatches,
          totalNewMatches: formattedMatches.length,
          appUrl: APP_URL,
        }),
      );

      const { error: sendError } = await resend.emails.send({
        from: FROM,
        to: user.email,
        subject: `Your Weekly Grant Digest — ${formattedMatches.length} new match${formattedMatches.length !== 1 ? "es" : ""}`,
        html,
      });
      if (sendError) throw new Error(sendError.message);

      sent++;
    } catch (e) {
      console.error(`Digest send failed for user ${sub.user_id}:`, e);
      failed++;
    }
  }

  return { sent, failed };
};
