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

interface DigestMatch {
  title: string;
  funderName: string;
  matchScore: number;
  deadline?: string;
  url: string;
}

interface DigestEmailProps {
  userName?: string;
  orgName?: string;
  matches?: DigestMatch[];
  totalNewMatches?: number;
  appUrl?: string;
}

export default function DigestEmail({
  userName = "there",
  orgName = "Your Organization",
  matches = [],
  totalNewMatches = 0,
  appUrl = "https://grantpilot.ai",
}: DigestEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>
        {`${totalNewMatches} new grant matches for ${orgName} this week`}
      </Preview>
      <Body style={{ backgroundColor: "#f8fafc", fontFamily: "Arial, sans-serif" }}>
        <Container style={{ maxWidth: 600, margin: "0 auto", padding: "40px 20px" }}>
          <Heading style={{ color: "#1a2d8a", fontSize: 24 }}>
            Your Weekly Grant Digest
          </Heading>
          <Text style={{ color: "#475569", fontSize: 15 }}>
            Hi {userName}, here are your top new matches for <strong>{orgName}</strong> this week.
          </Text>
          {matches.length === 0 ? (
            <Section
              style={{
                backgroundColor: "#ffffff",
                borderRadius: 8,
                padding: 20,
                margin: "20px 0",
                border: "1px solid #e2e8f0",
                textAlign: "center",
              }}
            >
              <Text style={{ color: "#94a3b8" }}>
                No new matches this week. Complete your profile to improve matching.
              </Text>
              <Link href={`${appUrl}/dashboard/profile`} style={{ color: "#4f6ef7" }}>
                Update Profile →
              </Link>
            </Section>
          ) : (
            matches.map((match, i) => {
              const scoreColor =
                match.matchScore >= 70 ? "#22c55e" : match.matchScore >= 40 ? "#f59e0b" : "#ef4444";
              return (
                <Section
                  key={i}
                  style={{
                    backgroundColor: "#ffffff",
                    borderRadius: 8,
                    padding: 16,
                    margin: "12px 0",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <Text style={{ color: "#1e293b", fontWeight: "bold", fontSize: 15, margin: 0 }}>
                        {match.title}
                      </Text>
                      <Text style={{ color: "#64748b", fontSize: 13, margin: "4px 0 0 0" }}>
                        {match.funderName}
                        {match.deadline ? ` · Deadline: ${match.deadline}` : ""}
                      </Text>
                    </div>
                    <Text style={{ color: scoreColor, fontWeight: "bold", fontSize: 18, margin: "0 0 0 12px" }}>
                      {match.matchScore}%
                    </Text>
                  </div>
                  <Link href={match.url} style={{ color: "#4f6ef7", fontSize: 13 }}>
                    View Details →
                  </Link>
                </Section>
              );
            })
          )}
          <Link
            href={`${appUrl}/dashboard/matches`}
            style={{
              backgroundColor: "#4f6ef7",
              color: "#ffffff",
              padding: "12px 24px",
              borderRadius: 6,
              textDecoration: "none",
              fontWeight: "bold",
              display: "inline-block",
              marginTop: 16,
            }}
          >
            View All Matches →
          </Link>
          <Text style={{ color: "#94a3b8", fontSize: 12, marginTop: 32 }}>
            Manage digest preferences in{" "}
            <Link href={`${appUrl}/dashboard/settings`} style={{ color: "#4f6ef7" }}>
              Settings
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
