import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { randomUUID } from "crypto";
import InviteEmail from "@/components/rsvp/invite-email";

function getResend() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured");
  }
  return new Resend(process.env.RESEND_API_KEY);
}

export async function POST(request: Request) {
  try {
    const resend = getResend();
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { guest_ids, event_id } = body;

    if (!guest_ids?.length || !event_id) {
      return NextResponse.json(
        { error: "guest_ids and event_id are required" },
        { status: 400 },
      );
    }

    // Fetch tokens, guests, and event in parallel
    const [tokensResult, guestsResult, eventResult, rsvpPageResult] =
      await Promise.all([
        supabase
          .from("rsvp_tokens")
          .select("*")
          .eq("event_id", event_id)
          .in("guest_id", guest_ids),
        supabase
          .from("guests")
          .select("id, name, email")
          .in("id", guest_ids),
        supabase
          .from("events")
          .select("id, name, wedding_date, venue")
          .eq("id", event_id)
          .single(),
        supabase
          .from("rsvp_pages")
          .select("couple_names")
          .eq("event_id", event_id)
          .single(),
      ]);

    if (!eventResult.data) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const event = eventResult.data;
    const coupleNames =
      rsvpPageResult.data?.couple_names || event.name || "Us";
    const eventDate = event.wedding_date
      ? new Date(event.wedding_date + "T00:00:00").toLocaleDateString(
          "en-US",
          { weekday: "long", year: "numeric", month: "long", day: "numeric" },
        )
      : "TBD";
    const venue = event.venue || "";

    const tokensByGuest: Record<string, any> = {};
    for (const t of tokensResult.data || []) {
      tokensByGuest[t.guest_id] = t;
    }

    const guestsById: Record<string, any> = {};
    for (const g of guestsResult.data || []) {
      guestsById[g.id] = g;
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const sent: string[] = [];
    const failed: { guest_id: string; error: string }[] = [];

    for (const guest_id of guest_ids) {
      const guest = guestsById[guest_id];
      const token = tokensByGuest[guest_id];

      if (!guest) {
        failed.push({ guest_id, error: "Guest not found" });
        continue;
      }

      if (!guest.email) {
        failed.push({ guest_id, error: "No email address" });
        continue;
      }

      let activeToken = token;
      if (!activeToken) {
        // Auto-generate token inline
        const newTokenStr = randomUUID();
        const { data: newToken, error: tokenErr } = await supabase
          .from("rsvp_tokens")
          .insert({ guest_id, event_id, token: newTokenStr })
          .select()
          .single();
        if (tokenErr || !newToken) {
          failed.push({ guest_id, error: "Failed to auto-generate token" });
          continue;
        }
        activeToken = newToken;
      }

      const rsvpUrl = `${appUrl}/rsvp/${activeToken.token}`;

      try {
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
          to: guest.email,
          subject: `You're invited to ${coupleNames}'s wedding!`,
          react: InviteEmail({
            guestName: guest.name,
            coupleNames,
            eventDate,
            venue,
            rsvpUrl,
          }),
        });

        // Update invite_sent_at
        await supabase
          .from("rsvp_tokens")
          .update({ invite_sent_at: new Date().toISOString() })
          .eq("id", activeToken.id);

        sent.push(guest_id);
      } catch (emailError: any) {
        failed.push({
          guest_id,
          error: emailError?.message || "Failed to send email",
        });
      }
    }

    return NextResponse.json({ sent, failed });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
