import { inngest } from "@/inngest/client";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { render } from "@react-email/render";
import { Resend } from "resend";
import DigestEmail from "@/emails/DigestEmail";

const resend = new Resend(process.env.RESEND_API_KEY);
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://grantpilot.ai";
const FROM = process.env.EMAIL_FROM ?? "hello@grantpilot.ai";

export const sendDigestEmails = inngest.createFunction(
  { id: "send-digest-emails", name: "Send Digest Emails", concurrency: { limit: 1 }, triggers: [{ cron: "0 9 * * 1" }] },
  async ({ step }) => {
    // Get orgs with weekly digest preference
    const subscribers = await step.run("get-subscribers", async () => {
      const { data } = await supabaseAdmin
        .from("alert_configs")
        .select(`
          user_id,
          org_id,
          users!inner(email, full_name),
          organizations!inner(legal_name)
        `)
        .eq("digest_frequency", "weekly")
        .eq("email_enabled", true);
      return data ?? [];
    });

    let sent = 0;
    let failed = 0;

    for (const sub of subscribers) {
      await step.run(`send-digest-${sub.user_id}`, async () => {
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

        const user = sub.users as unknown as { email: string; full_name?: string };
        const org = sub.organizations as unknown as { legal_name: string };

        const html = await render(
          DigestEmail({
            userName: user.full_name ?? "there",
            orgName: org.legal_name,
            matches: formattedMatches,
            totalNewMatches: formattedMatches.length,
            appUrl: APP_URL,
          }),
        );

        await resend.emails.send({
          from: FROM,
          to: user.email,
          subject: `Your Weekly Grant Digest — ${formattedMatches.length} new match${formattedMatches.length !== 1 ? "es" : ""}`,
          html,
        });

        sent++;
      }).catch(() => { failed++; });
    }

    return { sent, failed };
  },
);
