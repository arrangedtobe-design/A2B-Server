import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const event_id = searchParams.get("event_id");
    const timeline_id = searchParams.get("timeline_id");

    if (!event_id || !timeline_id) {
      return NextResponse.json(
        { error: "event_id and timeline_id are required" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("timeline_shares")
      .select("*")
      .eq("event_id", event_id)
      .eq("timeline_id", timeline_id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ shares: data });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

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
    const { event_id, timeline_id, mode, vendor_ids, label } = body;

    if (!event_id || !timeline_id || !mode) {
      return NextResponse.json(
        { error: "event_id, timeline_id, and mode are required" },
        { status: 400 },
      );
    }

    if (mode !== "all" && mode !== "vendor") {
      return NextResponse.json(
        { error: "mode must be 'all' or 'vendor'" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("timeline_shares")
      .insert({
        event_id,
        timeline_id,
        mode,
        vendor_ids: vendor_ids || [],
        label: label || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ share: data });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 },
      );
    }

    const { error } = await supabase
      .from("timeline_shares")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
