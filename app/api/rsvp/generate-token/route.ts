import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { guest_ids, event_id, regenerate } = body;

    if (!guest_ids?.length || !event_id) {
      return NextResponse.json(
        { error: "guest_ids and event_id are required" },
        { status: 400 },
      );
    }

    // Fetch existing tokens for these guests
    const { data: existingTokens } = await supabase
      .from("rsvp_tokens")
      .select("*")
      .eq("event_id", event_id)
      .in("guest_id", guest_ids);

    const existingByGuest: Record<string, any> = {};
    for (const t of existingTokens || []) {
      existingByGuest[t.guest_id] = t;
    }

    const results: { guest_id: string; token: string; is_new: boolean }[] = [];

    for (const guest_id of guest_ids) {
      const existing = existingByGuest[guest_id];

      if (existing && !regenerate) {
        // Token already exists, return it
        results.push({ guest_id, token: existing.token, is_new: false });
        continue;
      }

      if (existing && regenerate) {
        // Delete old response and token
        await supabase
          .from("rsvp_responses")
          .delete()
          .eq("token_id", existing.id);
        await supabase.from("rsvp_tokens").delete().eq("id", existing.id);
      }

      // Create new token
      const token = randomUUID();
      const { error: insertError } = await supabase
        .from("rsvp_tokens")
        .insert({
          guest_id,
          event_id,
          token,
        });

      if (insertError) {
        console.error("Failed to create token for guest", guest_id, JSON.stringify(insertError));
        continue;
      }
      console.log("Token created for guest", guest_id);

      results.push({ guest_id, token, is_new: true });
    }

    return NextResponse.json({ tokens: results });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
