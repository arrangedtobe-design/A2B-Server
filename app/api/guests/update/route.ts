import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

// Anon client for DB writes (same pattern as /api/rsvp/submit)
function createAnonClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { getAll() { return []; }, setAll() {} } },
  );
}

export async function POST(request: Request) {
  try {
    // Verify the user is authenticated
    const cookieStore = await cookies();
    const authClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll() {},
        },
      },
    );
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;
    const supabase = createAnonClient();

    // Update a guest's direct fields (meal_preference, rsvp_status, etc.)
    if (action === "update_guest") {
      const { guest_id, updates } = body;
      if (!guest_id || !updates) {
        return NextResponse.json({ error: "Missing guest_id or updates" }, { status: 400 });
      }
      const { error } = await supabase
        .from("guests")
        .update(updates)
        .eq("id", guest_id);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    // Update party responses on rsvp_responses
    if (action === "update_party_response") {
      const { response_id, guest_id, event_id, token_id, party_responses, attending } = body;

      if (response_id) {
        // Update existing response
        const { error } = await supabase
          .from("rsvp_responses")
          .update({ party_responses, updated_at: new Date().toISOString() })
          .eq("id", response_id);
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
      } else {
        // Insert new response — token_id is required by the table
        if (!token_id) {
          return NextResponse.json({ error: "No RSVP token for this guest. Send an invite first." }, { status: 400 });
        }
        const { error } = await supabase
          .from("rsvp_responses")
          .insert({
            token_id,
            guest_id,
            event_id,
            attending: attending || "yes",
            party_responses,
          });
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
