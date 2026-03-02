import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import RsvpPage from "./rsvp-page";
import type {
  RsvpPage as RsvpPageType,
  RsvpToken,
  RsvpGuestData,
  RsvpEventData,
  RsvpResponse,
  RsvpFormConfig,
  RsvpBlock,
} from "@/lib/rsvp/types";

// No auth required — this page is fully public

function createAnonClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {},
      },
    },
  );
}

export default async function RsvpTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createAnonClient();

  // Look up the token
  const { data: tokenRow, error: tokenError } = await supabase
    .from("rsvp_tokens")
    .select("*")
    .eq("token", token)
    .single();

  console.log("[RSVP] Token lookup:", { token, tokenRow, tokenError });

  if (!tokenRow) {
    notFound();
  }

  const rsvpToken = tokenRow as RsvpToken;

  // Mark as viewed
  if (!rsvpToken.viewed_at) {
    await supabase
      .from("rsvp_tokens")
      .update({ viewed_at: new Date().toISOString() })
      .eq("id", rsvpToken.id);
  }

  // Fetch the RSVP page, guest, event, and existing response in parallel
  const [pageResult, guestResult, eventResult, responseResult] =
    await Promise.all([
      supabase
        .from("rsvp_pages")
        .select("*")
        .eq("event_id", rsvpToken.event_id)
        .single(),
      supabase
        .from("guests")
        .select("id, name, email, party_members")
        .eq("id", rsvpToken.guest_id)
        .single(),
      supabase
        .from("events")
        .select("id, name, wedding_date, venue")
        .eq("id", rsvpToken.event_id)
        .single(),
      supabase
        .from("rsvp_responses")
        .select("*")
        .eq("token_id", rsvpToken.id)
        .single(),
    ]);

  console.log("[RSVP] Page:", pageResult.error);
  console.log("[RSVP] Guest:", guestResult.error);
  console.log("[RSVP] Event:", eventResult.error);

  if (!pageResult.data || !guestResult.data || !eventResult.data) {
    notFound();
  }

  const page = pageResult.data as RsvpPageType;
  const guest = guestResult.data as RsvpGuestData;
  const event = eventResult.data as RsvpEventData;
  const existingResponse = (responseResult.data as RsvpResponse) || null;

  // If page is not published, show a message
  if (!page.is_published) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <h1 className="text-2xl font-semibold text-gray-700 mb-2">
            Not Yet Available
          </h1>
          <p className="text-gray-500">
            This RSVP page is still being prepared. Please check back later.
          </p>
        </div>
      </div>
    );
  }

  return (
    <RsvpPage
      page={page}
      guest={guest}
      event={event}
      token={rsvpToken}
      existingResponse={existingResponse}
    />
  );
}
