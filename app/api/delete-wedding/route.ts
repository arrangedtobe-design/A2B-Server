import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { eventId } = await request.json();
  if (!eventId) {
    return NextResponse.json({ error: "Missing eventId" }, { status: 400 });
  }

  // Verify the user is the owner of this event
  const { data: membership } = await supabase
    .from("event_members")
    .select("role")
    .eq("event_id", eventId)
    .eq("user_id", user.id)
    .single();

  if (!membership || membership.role !== "owner") {
    return NextResponse.json({ error: "Only the owner can delete a wedding" }, { status: 403 });
  }

  try {
    // Delete all related data (order matters for foreign key constraints)
    await Promise.all([
      supabase.from("rsvp_responses").delete().eq("event_id", eventId),
      supabase.from("rsvp_tokens").delete().eq("event_id", eventId),
      supabase.from("seating_assignments").delete().eq("event_id", eventId),
    ]);

    await Promise.all([
      supabase.from("guests").delete().eq("event_id", eventId),
      supabase.from("seating_tables").delete().eq("event_id", eventId),
      supabase.from("vendors").delete().eq("event_id", eventId),
      supabase.from("tasks").delete().eq("event_id", eventId),
      supabase.from("budget_items").delete().eq("event_id", eventId),
      supabase.from("rsvp_pages").delete().eq("event_id", eventId),
      supabase.from("timeline_events").delete().eq("event_id", eventId),
    ]);

    await supabase.from("event_members").delete().eq("event_id", eventId);
    await supabase.from("events").delete().eq("id", eventId);

    return NextResponse.json({ message: "Wedding deleted successfully" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to delete wedding" }, { status: 500 });
  }
}
