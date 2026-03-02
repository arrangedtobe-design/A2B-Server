import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

// Use a service-role-like anon client (no auth cookies needed)
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      token,
      attending,
      meal_preference,
      plus_one,
      plus_one_name,
      dietary_notes,
      custom_answers,
      party_responses,
      comment,
    } = body;

    if (!token || !attending) {
      return NextResponse.json(
        { error: "Token and attending status are required" },
        { status: 400 },
      );
    }

    if (attending !== "yes" && attending !== "no") {
      return NextResponse.json(
        { error: "Attending must be 'yes' or 'no'" },
        { status: 400 },
      );
    }

    const supabase = createAnonClient();

    // Look up the token
    const { data: tokenRow, error: tokenError } = await supabase
      .from("rsvp_tokens")
      .select("*")
      .eq("token", token)
      .single();

    if (tokenError || !tokenRow) {
      return NextResponse.json(
        { error: "Invalid RSVP token" },
        { status: 404 },
      );
    }

    // Upsert the response (one response per token)
    const responseData = {
      token_id: tokenRow.id,
      guest_id: tokenRow.guest_id,
      event_id: tokenRow.event_id,
      attending,
      meal_preference: meal_preference || null,
      plus_one: plus_one || false,
      plus_one_name: plus_one_name || null,
      dietary_notes: dietary_notes || null,
      custom_answers: custom_answers || null,
      party_responses: party_responses || null,
      comment: comment || null,
    };

    // Check if a response already exists
    const { data: existingResponse } = await supabase
      .from("rsvp_responses")
      .select("id")
      .eq("token_id", tokenRow.id)
      .single();

    if (existingResponse) {
      // Update existing response
      const { error: updateError } = await supabase
        .from("rsvp_responses")
        .update({ ...responseData, updated_at: new Date().toISOString() })
        .eq("id", existingResponse.id);

      if (updateError) {
        return NextResponse.json(
          { error: "Failed to update RSVP" },
          { status: 500 },
        );
      }
    } else {
      // Insert new response
      const { error: insertError } = await supabase
        .from("rsvp_responses")
        .insert(responseData);

      if (insertError) {
        return NextResponse.json(
          { error: "Failed to save RSVP" },
          { status: 500 },
        );
      }
    }

    // Update token responded_at
    await supabase
      .from("rsvp_tokens")
      .update({ responded_at: new Date().toISOString() })
      .eq("id", tokenRow.id);

    // Sync back to guests table
    const guestUpdate: Record<string, unknown> = {
      rsvp_status: attending === "yes" ? "confirmed" : "declined",
    };

    if (attending === "yes") {
      if (meal_preference) guestUpdate.meal_preference = meal_preference;
      guestUpdate.plus_one = plus_one || false;
    }

    await supabase
      .from("guests")
      .update(guestUpdate)
      .eq("id", tokenRow.guest_id);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
