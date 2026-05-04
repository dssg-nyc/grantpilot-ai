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

interface WelcomeEmailProps {
  userName?: string;
  appUrl?: string;
}

export default function WelcomeEmail({
  userName = "there",
  appUrl = "https://grantpilot.ai",
}: WelcomeEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Welcome to GrantPilot AI — your AI fundraising co-pilot</Preview>
      <Body style={{ backgroundColor: "#f8fafc", fontFamily: "Arial, sans-serif" }}>
        <Container style={{ maxWidth: 600, margin: "0 auto", padding: "40px 20px" }}>
          <Heading style={{ color: "#1a2d8a", fontSize: 28 }}>
            Welcome to GrantPilot AI, {userName}!
          </Heading>
          <Text style={{ color: "#334155", fontSize: 16, lineHeight: 1.6 }}>
            You now have access to the most intelligent grant discovery platform built for nonprofits.
          </Text>
          <Section
            style={{
              backgroundColor: "#ffffff",
              borderRadius: 8,
              padding: 24,
              margin: "24px 0",
              border: "1px solid #e2e8f0",
            }}
          >
            <Text style={{ color: "#334155", fontWeight: "bold", margin: 0 }}>
              Here&apos;s what to do first:
            </Text>
            <Text style={{ color: "#64748b", margin: "8px 0 0 0" }}>
              1. Complete your organization profile (takes ~5 minutes)
            </Text>
            <Text style={{ color: "#64748b", margin: "4px 0 0 0" }}>
              2. Get matched with funding opportunities that fit your mission
            </Text>
            <Text style={{ color: "#64748b", margin: "4px 0 0 0" }}>
              3. Track your applications in your pipeline
            </Text>
          </Section>
          <Link
            href={`${appUrl}/onboarding`}
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
            Complete Your Profile →
          </Link>
          <Text style={{ color: "#94a3b8", fontSize: 13, marginTop: 32 }}>
            You&apos;re receiving this because you signed up for GrantPilot AI.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
