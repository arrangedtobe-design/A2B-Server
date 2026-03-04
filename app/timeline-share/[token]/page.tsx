import { createServerClient } from "@supabase/ssr";
import { notFound } from "next/navigation";
import { SharedTimeline } from "./shared-timeline";

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

export default async function TimelineSharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createAnonClient();

  // Look up the share by token
  const { data: share, error: shareError } = await supabase
    .from("timeline_shares")
    .select("*")
    .eq("token", token)
    .single();

  if (shareError || !share) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Link Unavailable</h1>
          <p className="text-gray-500 text-sm">
            This shared timeline link no longer exists. It may have been revoked by the organizer or the timeline may have been removed.
          </p>
        </div>
      </div>
    );
  }

  // Fetch timeline, items, event, and vendor assignments in parallel
  const [timelineResult, itemsResult, eventResult, eventVendorsResult] =
    await Promise.all([
      supabase
        .from("timelines")
        .select("*")
        .eq("id", share.timeline_id)
        .single(),
      supabase
        .from("timeline_events")
        .select("*")
        .eq("timeline_id", share.timeline_id)
        .eq("is_trashed", false)
        .order("start_time")
        .order("sort_order"),
      supabase
        .from("events")
        .select("id, name, wedding_date, venue")
        .eq("id", share.event_id)
        .single(),
      supabase
        .from("timeline_event_vendors")
        .select("timeline_event_id, vendor_id"),
    ]);

  if (!timelineResult.data || !eventResult.data) {
    console.error("Timeline share data fetch failed:",
      timelineResult.error?.message,
      eventResult.error?.message,
    );
    notFound();
  }

  // Build event-vendor map (timeline_event_id -> vendor_ids)
  // Filter to only include entries for items in this timeline
  const itemIds = new Set((itemsResult.data || []).map((i: any) => i.id));
  const eventVendors: Record<string, string[]> = {};
  for (const row of eventVendorsResult.data || []) {
    if (!itemIds.has(row.timeline_event_id)) continue;
    if (!eventVendors[row.timeline_event_id]) eventVendors[row.timeline_event_id] = [];
    eventVendors[row.timeline_event_id].push(row.vendor_id);
  }

  // Fetch all vendors referenced by timeline events (and share vendor_ids)
  const allVendorIds = new Set<string>();
  for (const vids of Object.values(eventVendors)) {
    for (const vid of vids) allVendorIds.add(vid);
  }
  if (share.vendor_ids?.length) {
    for (const vid of share.vendor_ids) allVendorIds.add(vid);
  }
  let vendors: { id: string; name: string; color: string }[] = [];
  if (allVendorIds.size > 0) {
    const { data: vendorData } = await supabase
      .from("vendors")
      .select("id, name, color")
      .in("id", Array.from(allVendorIds));
    vendors = vendorData || [];
  }

  return (
    <SharedTimeline
      items={itemsResult.data || []}
      vendors={vendors}
      eventVendors={eventVendors}
      timeline={timelineResult.data}
      event={eventResult.data}
      share={share}
    />
  );
}
