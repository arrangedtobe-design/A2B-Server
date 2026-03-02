import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Button,
  Hr,
  Preview,
} from "@react-email/components";

interface InviteEmailProps {
  guestName: string;
  coupleNames: string;
  eventDate: string;
  venue: string;
  rsvpUrl: string;
}

export default function InviteEmail({
  guestName,
  coupleNames,
  eventDate,
  venue,
  rsvpUrl,
}: InviteEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>You&apos;re invited to {coupleNames}&apos;s wedding!</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={section}>
            <Text style={greeting}>Dear {guestName},</Text>
            <Text style={heading}>
              You&apos;re invited to {coupleNames}&apos;s wedding!
            </Text>
            <Hr style={hr} />
            <Text style={detail}>
              <strong>Date:</strong> {eventDate}
            </Text>
            {venue && (
              <Text style={detail}>
                <strong>Venue:</strong> {venue}
              </Text>
            )}
            <Hr style={hr} />
            <Text style={message}>
              We would be honored to have you celebrate this special day with us.
              Please let us know if you can attend by clicking the button below.
            </Text>
            <Section style={buttonContainer}>
              <Button style={button} href={rsvpUrl}>
                RSVP Now
              </Button>
            </Section>
            <Text style={footer}>
              If the button doesn&apos;t work, copy and paste this link into your
              browser: {rsvpUrl}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const body = {
  backgroundColor: "#f9fafb",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  margin: "0",
  padding: "0",
};

const container = {
  maxWidth: "560px",
  margin: "0 auto",
  padding: "40px 20px",
};

const section = {
  backgroundColor: "#ffffff",
  borderRadius: "8px",
  padding: "40px 32px",
  border: "1px solid #e5e7eb",
};

const greeting = {
  fontSize: "16px",
  color: "#374151",
  margin: "0 0 16px",
};

const heading = {
  fontSize: "24px",
  fontWeight: "600" as const,
  color: "#111827",
  margin: "0 0 24px",
  textAlign: "center" as const,
};

const hr = {
  borderColor: "#e5e7eb",
  margin: "24px 0",
};

const detail = {
  fontSize: "16px",
  color: "#374151",
  margin: "0 0 8px",
  textAlign: "center" as const,
};

const message = {
  fontSize: "15px",
  color: "#6b7280",
  lineHeight: "1.6",
  margin: "0 0 24px",
  textAlign: "center" as const,
};

const buttonContainer = {
  textAlign: "center" as const,
  margin: "0 0 24px",
};

const button = {
  backgroundColor: "#e11d48",
  borderRadius: "6px",
  color: "#ffffff",
  fontSize: "16px",
  fontWeight: "600" as const,
  textDecoration: "none",
  textAlign: "center" as const,
  padding: "12px 32px",
  display: "inline-block",
};

const footer = {
  fontSize: "12px",
  color: "#9ca3af",
  textAlign: "center" as const,
  wordBreak: "break-all" as const,
};
