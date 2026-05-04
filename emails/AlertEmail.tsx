import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

interface AlertEmailProps {
  userName?: string;
  opportunityTitle?: string;
  funderName?: string;
  matchScore?: number;
  successProbability?: number;
  deadline?: string;
  opportunityUrl?: string;
  appUrl?: string;
}

export default function AlertEmail({
  userName = "there",
  opportunityTitle = "New Funding Opportunity",
  funderName = "Funder",
  matchScore = 85,
  successProbability = 72,
  deadline,
  opportunityUrl = "#",
  appUrl = "https://grantpilot.ai",
}: AlertEmailProps) {
  const scoreColor =
    matchScore >= 70 ? "#22c55e" : matchScore >= 40 ? "#f59e0b" : "#ef4444";

  return (
    <Html>
      <Head />
      <Preview>
        {`${matchScore}% match: ${opportunityTitle} from ${funderName}`}
      </Preview>
      <Body style={{ backgroundColor: "#f8fafc", fontFamily: "Arial, sans-serif" }}>
        <Container style={{ maxWidth: 600, margin: "0 auto", padding: "40px 20px" }}>
          <Text style={{ color: "#64748b", fontSize: 13, margin: "0 0 8px 0" }}>
            NEW HIGH-MATCH OPPORTUNITY
          </Text>
          <Heading style={{ color: "#1a2d8a", fontSize: 24, margin: "0 0 16px 0" }}>
            {opportunityTitle}
          </Heading>
          <Text style={{ color: "#475569", fontSize: 15 }}>
            Hi {userName}, we found a strong match for your organization from{" "}
            <strong>{funderName}</strong>.
          </Text>
          <Section
            style={{
              backgroundColor: "#ffffff",
              borderRadius: 8,
              padding: 20,
              margin: "20px 0",
              border: "1px solid #e2e8f0",
            }}
          >
            <div style={{ display: "flex", gap: 24 }}>
              <div>
                <Text style={{ color: "#94a3b8", fontSize: 12, margin: 0 }}>MATCH SCORE</Text>
                <Text style={{ color: scoreColor, fontSize: 28, fontWeight: "bold", margin: "4px 0 0 0" }}>
                  {matchScore}%
                </Text>
              </div>
              <div>
                <Text style={{ color: "#94a3b8", fontSize: 12, margin: 0 }}>SUCCESS PROBABILITY</Text>
                <Text style={{ color: scoreColor, fontSize: 28, fontWeight: "bold", margin: "4px 0 0 0" }}>
                  {successProbability}%
                </Text>
              </div>
              {deadline && (
                <div>
                  <Text style={{ color: "#94a3b8", fontSize: 12, margin: 0 }}>DEADLINE</Text>
                  <Text style={{ color: "#ef4444", fontSize: 16, fontWeight: "bold", margin: "4px 0 0 0" }}>
                    {deadline}
                  </Text>
                </div>
              )}
            </div>
          </Section>
          <Link
            href={opportunityUrl}
            style={{
              backgroundColor: "#4f6ef7",
              color: "#ffffff",
              padding: "12px 24px",
              borderRadius: 6,
              textDecoration: "none",
              fontWeight: "bold",
              display: "inline-block",
            }}
          >
            View Full Details →
          </Link>
          <Text style={{ color: "#94a3b8", fontSize: 12, marginTop: 32 }}>
            Manage your alerts in{" "}
            <Link href={`${appUrl}/dashboard/settings`} style={{ color: "#4f6ef7" }}>
              GrantPilot Settings
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
