"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useThemeColors } from "@/lib/use-theme-colors";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { useNotification } from "@/components/ui/notification";
import {
  CATEGORIES, DURATION_OPTIONS, PIXELS_PER_MINUTE, MIN_EVENT_HEIGHT,
  formatTime, getEndTime, formatDuration, timeToMinutes, minutesToTime, formatHourLabel, layoutEvents,
  formatDateShort, formatDateLong,
  TEMPLATES, Template, LayoutItem,
} from "./timeline-data";
import { TimelinePreview } from "./timeline-preview";

function TemplateSelector({ onSelect, onEmpty, onCancel, showCancel }: {
  onSelect: (t: Template) => void; onEmpty: () => void; onCancel?: () => void; showCancel: boolean;
}) {
  return (
    <div>
      <div className="text-center mb-8">
        <h2 className="text-xl font-semibold text-heading mt-4">Choose Your Starting Point</h2>
        <p className="text-subtle mt-1">Pick a template or build from scratch</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {TEMPLATES.map((t) => (
          <button key={t.id} onClick={() => onSelect(t)} className="text-left bg-surface p-5 rounded-lg shadow hover:shadow-md border border-app-border hover:border-rose-app">
            <div className="text-2xl mb-2">{t.icon}</div>
            <p className="font-semibold text-heading">{t.name}</p>
            <p className="text-sm text-subtle mt-1">{t.description}</p>
            <p className="text-xs text-subtle mt-2">{t.eventCount} events · {t.duration}</p>
          </button>
        ))}
      </div>
      <button onClick={onEmpty} className="w-full bg-surface text-body py-3 rounded-lg border-2 border-dashed border-app-border hover:border-rose-app hover:text-rose-app font-medium mb-3">Start with Empty Timeline</button>
      {showCancel && onCancel && <button onClick={onCancel} className="w-full text-subtle py-2 text-sm">Cancel</button>}
    </div>
  );
}

export default function TimelineView({ userId }: { userId: string }) {
  const [timelines, setTimelines] = useState<any[]>([]);
  const [activeTimelineId, setActiveTimelineId] = useState<string | null>(null);
  const [activeTl, setActiveTl] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [trashedItems, setTrashedItems] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [eventVendors, setEventVendors] = useState<Record<string, string[]>>({});
  const [eventId, setEventId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasTimeline, setHasTimeline] = useState(false);
  const [showNewTemplates, setShowNewTemplates] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [category, setCategory] = useState("General");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedVendorIds, setSelectedVendorIds] = useState<string[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [sStartHour, setSStartHour] = useState(6);
  const [sEndHour, setSEndHour] = useState(24);
  const [sDate, setSDate] = useState<string>("");
  const [showTrash, setShowTrash] = useState(false);
  const [showManager, setShowManager] = useState(false);
  const [filterCategory, setFilterCategory] = useState("All");
  const [event, setEvent] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [undoItem, setUndoItem] = useState<any>(null);
  const [undoTimeout, setUndoTimeout] = useState<NodeJS.Timeout | null>(null);

  // Drag state
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragPreviewItems, setDragPreviewItems] = useState<any[] | null>(null);
  const [dragTimeLabel, setDragTimeLabel] = useState<string | null>(null);

  // Remote drag state (V2 live preview + locking)
  const [remoteDrags, setRemoteDrags] = useState<Record<string, { userId: string; startTime: string }>>({});

  const readyRef = useRef(false);
  const dragStartYRef = useRef(0);
  const dragMovedRef = useRef(false);
  const pendingDropRef = useRef(false);
  const dragOrigMinRef = useRef(0);
  const timelineRef = useRef<HTMLDivElement>(null);
  const remoteDragTimeouts = useRef<Record<string, NodeJS.Timeout>>({});
  const channelRef = useRef<any>(null);
  const lastBroadcastRef = useRef(0);
  const tabIdRef = useRef(Math.random().toString(36).slice(2) + Date.now().toString(36));
  const settingsPanelRef = useRef<HTMLDivElement>(null);
  const atBoundaryRef = useRef(false);
  const boundaryNotifIdRef = useRef<string | null>(null);
  const dStartMinRef = useRef(0);
  const dEndMinRef = useRef(0);

  const router = useRouter();
  const supabase = createClient();
  const themeColors = useThemeColors();
  const { notify, dismiss } = useNotification();
  const notifyRef = useRef(notify);
  const dismissRef = useRef(dismiss);
  notifyRef.current = notify;
  dismissRef.current = dismiss;

  useEffect(() => {
    const eid = localStorage.getItem("activeEventId");
    if (!eid) { router.push("/"); return; }
    setLoading(true); setShowNewTemplates(false);
    setEventId(eid); fetchVendors(eid); fetchTimelines(eid); fetchEvent(eid);
  }, []);

  useEffect(() => {
    if (!selectedItemId) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest("[data-detail-panel]") && !t.closest("[data-event-card]")) setSelectedItemId(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [selectedItemId]);

  // Realtime subscription — sync changes from other users + broadcast for live drag preview
  useEffect(() => {
    if (!eventId || !activeTimelineId) return;

    const channel = supabase
      .channel(`timeline-${activeTimelineId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "timeline_events",
          filter: `timeline_id=eq.${activeTimelineId}`,
        },
        () => {
          // Skip refetch if we're in the middle of our own drag-drop save
          if (pendingDropRef.current) return;
          fetchEvents(eventId, activeTimelineId);
        }
      )
      .on('broadcast', { event: 'drag_move' }, ({ payload }) => {
        if (payload.tabId === tabIdRef.current) return;
        const { cardId, startTime: st } = payload;
        setRemoteDrags(prev => ({ ...prev, [cardId]: { userId: payload.userId, startTime: st } }));
        // Reset 3-second timeout for this card (auto-clear if user disconnects)
        if (remoteDragTimeouts.current[cardId]) clearTimeout(remoteDragTimeouts.current[cardId]);
        remoteDragTimeouts.current[cardId] = setTimeout(() => {
          setRemoteDrags(prev => { const next = { ...prev }; delete next[cardId]; return next; });
          delete remoteDragTimeouts.current[cardId];
        }, 3000);
      })
      .on('broadcast', { event: 'drag_end' }, ({ payload }) => {
        if (payload.tabId === tabIdRef.current) return;
        const { cardId, startTime: finalTime } = payload;
        // Optimistically update items to final position so card doesn't snap back
        if (finalTime) {
          setItems(prev => prev.map(i => i.id === cardId ? { ...i, start_time: finalTime } : i));
        }
        setRemoteDrags(prev => { const next = { ...prev }; delete next[cardId]; return next; });
        if (remoteDragTimeouts.current[cardId]) {
          clearTimeout(remoteDragTimeouts.current[cardId]);
          delete remoteDragTimeouts.current[cardId];
        }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
      // Clear all remote drag timeouts
      Object.values(remoteDragTimeouts.current).forEach(t => clearTimeout(t));
      remoteDragTimeouts.current = {};
      setRemoteDrags({});
    };
  }, [eventId, activeTimelineId]);

  const fetchEvent = async (eid: string) => {
    const { data } = await supabase.from("events").select("id, name, wedding_date, venue").eq("id", eid).single();
    if (data) setEvent(data);
  };
  const fetchVendors = async (eid: string) => {
    const { data } = await supabase.from("vendors").select("*").eq("event_id", eid).order("name");
    setVendors(data || []);
  };
  const fetchTimelines = async (eid: string) => {
    const { data } = await supabase.from("timelines").select("*").eq("event_id", eid).order("created_at");
    setTimelines(data || []);
    if (data && data.length > 0) {
      const stored = localStorage.getItem("activeTimelineId");
      const tl = data.find((t: any) => t.id === stored) || data[0];
      setActiveTimelineId(tl.id); setActiveTl(tl); localStorage.setItem("activeTimelineId", tl.id);
      setSStartHour(tl.start_hour ?? 6); setSEndHour(tl.end_hour ?? 24); setSDate(tl.date || "");
      setHasTimeline(true); setShowNewTemplates(false);
      readyRef.current = true;
      await fetchEvents(eid, tl.id);
    } else {
      const { data: legacy } = await supabase.from("timeline_events").select("id").eq("event_id", eid).is("timeline_id", null).limit(1);
      if (legacy && legacy.length > 0) {
        const { data: newTl } = await supabase.from("timelines").insert({ event_id: eid, name: "Main Timeline", created_by: userId }).select().single();
        if (newTl) {
          await supabase.from("timeline_events").update({ timeline_id: newTl.id }).eq("event_id", eid).is("timeline_id", null);
          setActiveTimelineId(newTl.id); setActiveTl(newTl); localStorage.setItem("activeTimelineId", newTl.id);
          setTimelines([newTl]); setHasTimeline(true);
          readyRef.current = true;
          await fetchEvents(eid, newTl.id);
        }
      } else { setHasTimeline(false); readyRef.current = true; }
      setLoading(false);
    }
  };
  const fetchEvents = async (eid: string, tid: string) => {
    const { data: active } = await supabase.from("timeline_events").select("*").eq("event_id", eid).eq("timeline_id", tid).eq("is_trashed", false).order("start_time").order("sort_order");
    const { data: trashed } = await supabase.from("timeline_events").select("*").eq("event_id", eid).eq("timeline_id", tid).eq("is_trashed", true).order("trashed_at", { ascending: false });
    setItems(active || []); setTrashedItems(trashed || []);
    if (active && active.length > 0) {
      const { data: tevs } = await supabase.from("timeline_event_vendors").select("timeline_event_id, vendor_id").in("timeline_event_id", active.map((a: any) => a.id));
      const map: Record<string, string[]> = {};
      (tevs || []).forEach((r: any) => { if (!map[r.timeline_event_id]) map[r.timeline_event_id] = []; map[r.timeline_event_id].push(r.vendor_id); });
      setEventVendors(map);
    } else { setEventVendors({}); }
    setLoading(false);
  };
  const switchTimeline = async (tid: string) => {
    if (!eventId) return;
    const tl = timelines.find((t: any) => t.id === tid);
    setActiveTimelineId(tid); setActiveTl(tl); localStorage.setItem("activeTimelineId", tid);
    setSStartHour(tl?.start_hour ?? 6); setSEndHour(tl?.end_hour ?? 24); setSDate(tl?.date || "");
    setLoading(true); setFilterCategory("All"); setShowForm(false); setShowTrash(false);
    await fetchEvents(eventId, tid);
  };
  const selectTemplate = async (template: Template) => {
    if (!eventId) return; setLoading(true);
    const { data: tl } = await supabase.from("timelines").insert({ event_id: eventId, name: template.name, start_hour: template.startHour, end_hour: template.endHour, created_by: userId }).select().single();
    if (!tl) { setLoading(false); return; }
    const rows = template.events.map((evt, i) => ({ event_id: eventId, timeline_id: tl.id, title: evt.title, start_time: evt.start_time, duration_minutes: evt.duration_minutes, category: evt.category, location: evt.location || null, notes: evt.notes || null, sort_order: i, created_by: userId }));
    await supabase.from("timeline_events").insert(rows);
    setTimelines(prev => [...prev, tl]); setActiveTimelineId(tl.id); setActiveTl(tl);
    setSStartHour(tl.start_hour ?? 6); setSEndHour(tl.end_hour ?? 24);
    localStorage.setItem("activeTimelineId", tl.id); setHasTimeline(true); setShowNewTemplates(false);
    await fetchEvents(eventId, tl.id);
  };
  const startEmpty = async () => {
    if (!eventId) return; setLoading(true);
    const { data: tl } = await supabase.from("timelines").insert({ event_id: eventId, name: "New Timeline", start_hour: 8, end_hour: 23, created_by: userId }).select().single();
    if (!tl) { setLoading(false); return; }
    setTimelines(prev => [...prev, tl]); setActiveTimelineId(tl.id); setActiveTl(tl);
    setSStartHour(8); setSEndHour(23); localStorage.setItem("activeTimelineId", tl.id);
    setHasTimeline(true); setShowNewTemplates(false);
    setItems([]); setTrashedItems([]); setEventVendors({}); setLoading(false); setShowForm(true);
  };
  const saveSettings = async () => {
    if (!activeTimelineId) return;
    await supabase.from("timelines").update({ start_hour: sStartHour, end_hour: sEndHour, date: sDate || null }).eq("id", activeTimelineId);
    setTimelines(prev => prev.map(t => t.id === activeTimelineId ? { ...t, start_hour: sStartHour, end_hour: sEndHour, date: sDate || null } : t));
    setActiveTl((prev: any) => prev ? { ...prev, start_hour: sStartHour, end_hour: sEndHour, date: sDate || null } : prev);
    setShowSettings(false);
  };
  const resetForm = () => { setTitle(""); setStartTime(""); setDurationMinutes(30); setCategory("General"); setLocation(""); setNotes(""); setSelectedVendorIds([]); setEditingId(null); setShowForm(false); };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !startTime || !eventId || !activeTimelineId) return;
    const payload = { title: title.trim(), start_time: startTime, duration_minutes: durationMinutes, category, location: location.trim() || null, notes: notes.trim() || null };
    let teId: string;
    if (editingId) {
      await supabase.from("timeline_events").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", editingId);
      teId = editingId;
    } else {
      const { data } = await supabase.from("timeline_events").insert({ ...payload, event_id: eventId, timeline_id: activeTimelineId, sort_order: items.length, created_by: userId }).select().single();
      if (!data) return; teId = data.id;
    }
    await supabase.from("timeline_event_vendors").delete().eq("timeline_event_id", teId);
    if (selectedVendorIds.length > 0) await supabase.from("timeline_event_vendors").insert(selectedVendorIds.map(vid => ({ timeline_event_id: teId, vendor_id: vid })));
    resetForm(); setSelectedItemId(null); fetchEvents(eventId, activeTimelineId);
  };
  const startEdit = (item: any) => {
    setTitle(item.title); setStartTime(item.start_time?.slice(0, 5) || ""); setDurationMinutes(item.duration_minutes || 30);
    setCategory(item.category || "General"); setLocation(item.location || ""); setNotes(item.notes || "");
    setSelectedVendorIds(eventVendors[item.id] || []); setEditingId(item.id); setShowForm(true); setSelectedItemId(null);
  };
  const toggleVendor = (vid: string) => setSelectedVendorIds(prev => prev.includes(vid) ? prev.filter(v => v !== vid) : [...prev, vid]);

  const dStartMin = (activeTl?.start_hour ?? 6) * 60;
  const dEndMin = (activeTl?.end_hour ?? 24) * 60;
  dStartMinRef.current = dStartMin;
  dEndMinRef.current = dEndMin;

  // Build preview: just move the dragged item, layout engine handles overlap columns
  const buildPreview = useCallback((draggedId: string, newMin: number, allItems: any[]) => {
    return allItems.map(i => i.id === draggedId ? { ...i, start_time: minutesToTime(newMin) } : { ...i });
  }, []);

  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent, item: any) => {
    e.preventDefault(); e.stopPropagation();

    // Card locking: if another user is dragging this card, block
    if (remoteDrags[item.id]) return;

    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    dragStartYRef.current = clientY;
    dragOrigMinRef.current = timeToMinutes(item.start_time);

    if (pendingDropRef.current) return;
    dragMovedRef.current = false;
    setDragTimeLabel(null);
    setDragPreviewItems(null);

    const onMove = (ev: MouseEvent | TouchEvent) => {
      const y = "touches" in ev ? ev.touches[0].clientY : ev.clientY;

      // Wait for 5px movement before activating drag (prevents jump on click)
      if (!dragMovedRef.current) {
        if (Math.abs(y - dragStartYRef.current) < 5) return;
        dragMovedRef.current = true;
        setDragId(item.id);
      }

      const rawMin = dragOrigMinRef.current + (y - dragStartYRef.current) / PIXELS_PER_MINUTE;
      const snapped = Math.round(rawMin / 5) * 5;
      const minBound = dStartMinRef.current;
      const maxBound = dEndMinRef.current - item.duration_minutes;
      const clamped = Math.max(minBound, Math.min(maxBound, snapped));

      // Boundary detection
      if (snapped !== clamped && !atBoundaryRef.current) {
        atBoundaryRef.current = true;
        boundaryNotifIdRef.current = notifyRef.current({
          id: "drag-boundary",
          type: "warning",
          message: "Event can't be moved outside the timeline range.",
          action: {
            label: "Adjust Range",
            onClick: () => {
              setShowSettings(true);
              window.scrollTo({ top: 0, behavior: "smooth" });
              setTimeout(() => {
                if (settingsPanelRef.current) {
                  settingsPanelRef.current.classList.add("animate-pulse-highlight");
                  setTimeout(() => settingsPanelRef.current?.classList.remove("animate-pulse-highlight"), 2000);
                }
              }, 100);
            },
          },
        });
      } else if (snapped === clamped && atBoundaryRef.current) {
        atBoundaryRef.current = false;
        if (boundaryNotifIdRef.current) {
          dismissRef.current(boundaryNotifIdRef.current);
          boundaryNotifIdRef.current = null;
        }
      }

      setDragTimeLabel(formatTime(minutesToTime(clamped)));
      setDragPreviewItems(buildPreview(item.id, clamped, items));

      // Broadcast drag_move (throttled to ~5/second)
      const now = Date.now();
      if (channelRef.current && now - lastBroadcastRef.current > 200) {
        lastBroadcastRef.current = now;
        channelRef.current.send({
          type: 'broadcast',
          event: 'drag_move',
          payload: { cardId: item.id, userId, tabId: tabIdRef.current, startTime: minutesToTime(clamped) },
        });
      }
    };

    const onEnd = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onEnd);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      atBoundaryRef.current = false;

      if (!dragMovedRef.current) {
        setDragId(null); setDragTimeLabel(null); setDragPreviewItems(null);
        dragMovedRef.current = false;
        return;
      }

      setDragTimeLabel(null);
      pendingDropRef.current = true;

      setDragPreviewItems(preview => {
        if (!preview) {
          setDragId(null);
          pendingDropRef.current = false;
          return null;
        }
        const dragged = preview.find(p => p.id === item.id);
        const orig = items.find(i => i.id === item.id);
        if (dragged && orig && dragged.start_time !== orig.start_time) {
          // Optimistically update items so position holds when we clear drag preview
          setItems(prev => prev.map(i => i.id === item.id ? { ...i, start_time: dragged.start_time } : i));
          setDragId(null);
          pendingDropRef.current = false;

          // Broadcast drag_end with final position so remote tabs can optimistically update
          if (channelRef.current) {
            channelRef.current.send({
              type: 'broadcast',
              event: 'drag_end',
              payload: { cardId: item.id, userId, tabId: tabIdRef.current, startTime: dragged.start_time },
            });
          }

          supabase.from("timeline_events")
            .update({ start_time: dragged.start_time, updated_at: new Date().toISOString() })
            .eq("id", item.id)
            .then(() => {
              if (eventId && activeTimelineId) fetchEvents(eventId, activeTimelineId);
            });
          return null;
        } else {
          // No change — broadcast drag_end to unlock
          if (channelRef.current) {
            channelRef.current.send({
              type: 'broadcast',
              event: 'drag_end',
              payload: { cardId: item.id, userId, tabId: tabIdRef.current },
            });
          }
          setDragId(null);
          pendingDropRef.current = false;
          return null;
        }
      });
      setTimeout(() => { dragMovedRef.current = false; }, 50);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onEnd);
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
  }, [items, eventId, activeTimelineId, buildPreview, remoteDrags, userId]);

  const trashItem = async (item: any) => {
    if (!eventId || !activeTimelineId) return;
    await supabase.from("timeline_events").update({ is_trashed: true, trashed_at: new Date().toISOString() }).eq("id", item.id);
    setUndoItem(item); if (undoTimeout) clearTimeout(undoTimeout);
    setUndoTimeout(setTimeout(() => setUndoItem(null), 5000));
    setSelectedItemId(null); fetchEvents(eventId, activeTimelineId);
  };
  const undoTrash = async () => { if (!undoItem || !eventId || !activeTimelineId) return; await supabase.from("timeline_events").update({ is_trashed: false, trashed_at: null }).eq("id", undoItem.id); setUndoItem(null); if (undoTimeout) clearTimeout(undoTimeout); fetchEvents(eventId, activeTimelineId); };
  const restoreItem = async (id: string) => { if (!eventId || !activeTimelineId) return; await supabase.from("timeline_events").update({ is_trashed: false, trashed_at: null }).eq("id", id); fetchEvents(eventId, activeTimelineId); };
  const permanentDelete = async (id: string) => { if (!eventId || !activeTimelineId || !confirm("Permanently delete?")) return; await supabase.from("timeline_events").delete().eq("id", id); fetchEvents(eventId, activeTimelineId); };
  const emptyTrash = async () => { if (!eventId || !activeTimelineId || !confirm("Empty trash?")) return; for (const i of trashedItems) await supabase.from("timeline_events").delete().eq("id", i.id); fetchEvents(eventId, activeTimelineId); };
  const duplicateTimeline = async (sid: string) => {
    if (!eventId) return; setLoading(true);
    const src = timelines.find((t: any) => t.id === sid);
    const { data: tl } = await supabase.from("timelines").insert({ event_id: eventId, name: (src?.name || "Timeline") + " (Copy)", start_hour: src?.start_hour ?? 6, end_hour: src?.end_hour ?? 24, date: src?.date || null, created_by: userId }).select().single();
    if (!tl) { setLoading(false); return; }
    const { data: srcEvts } = await supabase.from("timeline_events").select("*").eq("timeline_id", sid).eq("is_trashed", false);
    if (srcEvts?.length) await supabase.from("timeline_events").insert(srcEvts.map((ev: any) => ({ event_id: eventId, timeline_id: tl.id, title: ev.title, start_time: ev.start_time, duration_minutes: ev.duration_minutes, category: ev.category, location: ev.location, notes: ev.notes, sort_order: ev.sort_order, is_trashed: false, created_by: userId })));
    setTimelines(prev => [...prev, tl]); switchTimeline(tl.id); setShowManager(false);
  };
  const deleteTimeline = async (tid: string) => {
    if (!eventId || !confirm("Delete this timeline?")) return; setLoading(true);
    await supabase.from("timeline_events").delete().eq("timeline_id", tid);
    await supabase.from("timelines").delete().eq("id", tid);
    const rem = timelines.filter((t: any) => t.id !== tid); setTimelines(rem);
    if (rem.length > 0) switchTimeline(rem[0].id);
    else { setActiveTimelineId(null); localStorage.removeItem("activeTimelineId"); setHasTimeline(false); setItems([]); setTrashedItems([]); setLoading(false); }
    setShowManager(false);
  };
  const resetAll = async () => {
    if (!eventId || !confirm("Delete ALL timelines?")) return; setLoading(true);
    for (const tl of timelines) { await supabase.from("timeline_events").delete().eq("timeline_id", tl.id); await supabase.from("timelines").delete().eq("id", tl.id); }
    setTimelines([]); setActiveTimelineId(null); localStorage.removeItem("activeTimelineId"); setItems([]); setTrashedItems([]); setHasTimeline(false); setLoading(false);
  };

  // Computed
  const totalHeight = (dEndMin - dStartMin) * PIXELS_PER_MINUTE;
  const filteredItems = filterCategory === "All" ? items : items.filter(i => i.category === filterCategory);
  let displayItems = dragPreviewItems ? (filterCategory === "All" ? dragPreviewItems : dragPreviewItems.filter(i => i.category === filterCategory)) : filteredItems;
  // Apply remote drag positions on top (live preview from other users)
  if (Object.keys(remoteDrags).length > 0) {
    displayItems = displayItems.map(item => {
      const rd = remoteDrags[item.id];
      return rd ? { ...item, start_time: rd.startTime } : item;
    });
  }
  const positioned = layoutEvents(displayItems, dStartMin);
  const hourLabels: { hour: number; label: string; top: number }[] = [];
  for (let h = activeTl?.start_hour ?? 6; h <= (activeTl?.end_hour ?? 24); h++) hourLabels.push({ hour: h, label: formatHourLabel(h), top: (h * 60 - dStartMin) * PIXELS_PER_MINUTE });
  const vendorName = (vid: string) => vendors.find(v => v.id === vid)?.name || "Unknown";
  const vendorColor = (vid: string) => vendors.find(v => v.id === vid)?.color || "#B8B8B8";
  const selectedItem = items.find(i => i.id === selectedItemId) || null;
  const CATEGORY_COLORS = themeColors.timelineCategories;

  if (loading || !readyRef.current) return <div className="min-h-screen flex items-center justify-center text-subtle">Loading...</div>;
  if (!hasTimeline) return (
    <div className="min-h-screen bg-page-bg"><div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center justify-between mb-2"><div className="flex items-center gap-3 min-w-0"><Link href="/dashboard" className="text-rose-app hover:text-rose-app-hover text-sm shrink-0">← Dashboard</Link><h1 className="text-2xl font-bold text-heading truncate">Wedding Day Timeline</h1></div><div className="flex items-center gap-2 shrink-0"><ThemeSwitcher /></div></div>
      <TemplateSelector onSelect={selectTemplate} onEmpty={startEmpty} showCancel={false} />
    </div></div>
  );
  if (showNewTemplates) return (
    <div className="min-h-screen bg-page-bg"><div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center justify-between mb-2"><div className="flex items-center gap-3 min-w-0"><a href="/dashboard" className="text-rose-app hover:text-rose-app-hover text-sm shrink-0">← Dashboard</a><h1 className="text-2xl font-bold text-heading truncate">New Timeline</h1></div><div className="flex items-center gap-2 shrink-0"><ThemeSwitcher /></div></div>
      <TemplateSelector onSelect={selectTemplate} onEmpty={startEmpty} onCancel={() => setShowNewTemplates(false)} showCancel={true} />
    </div></div>
  );

  const renderDetailPanel = () => {
    if (!selectedItem) return null;
    const bgColor = CATEGORY_COLORS[selectedItem.category] || CATEGORY_COLORS.General;
    const endTime = getEndTime(selectedItem.start_time, selectedItem.duration_minutes);
    const vids = eventVendors[selectedItem.id] || [];
    return (
      <div className="bg-surface rounded-lg shadow-lg border border-app-border overflow-hidden" data-detail-panel>
        <div className="h-2" style={{ backgroundColor: bgColor }}></div>
        <div className="p-4">
          <div className="flex justify-between items-start mb-3">
            <h3 className="text-lg font-bold text-heading">{selectedItem.title}</h3>
            <button onClick={() => setSelectedItemId(null)} className="text-subtle hover:text-body text-xl">×</button>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex gap-2"><span className="text-subtle w-20">Time</span><span className="font-medium text-heading">{formatTime(selectedItem.start_time)} → {formatTime(endTime)}</span></div>
            <div className="flex gap-2"><span className="text-subtle w-20">Duration</span><span className="font-medium text-heading">{formatDuration(selectedItem.duration_minutes)}</span></div>
            <div className="flex gap-2"><span className="text-subtle w-20">Category</span><span className="px-2 py-0.5 rounded-full text-xs" style={{ backgroundColor: bgColor + "40" }}>{selectedItem.category}</span></div>
            {selectedItem.location && <div className="flex gap-2"><span className="text-subtle w-20">Location</span><span className="text-body">{selectedItem.location}</span></div>}
            {vids.length > 0 && <div className="flex gap-2 flex-wrap"><span className="text-subtle w-20 shrink-0">Vendors</span><div className="flex flex-wrap gap-1">{vids.map(vid => <span key={vid} className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: vendorColor(vid) + "50" }}>{vendorName(vid)}</span>)}</div></div>}
            {selectedItem.notes && <div><span className="text-subtle">Notes</span><p className="mt-1 bg-page-bg p-2 rounded text-body">{selectedItem.notes}</p></div>}
          </div>
          <div className="flex gap-2 mt-4 pt-3 border-t border-app-border">
            <button onClick={() => startEdit(selectedItem)} className="flex-1 bg-rose-app text-white py-2 rounded-lg hover:bg-rose-app-hover text-sm font-medium">Edit</button>
            <button onClick={() => trashItem(selectedItem)} className="px-4 py-2 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 text-sm">Trash</button>
          </div>
        </div>
      </div>
    );
  };

  const renderForm = () => (
    <div className="bg-surface p-5 rounded-lg shadow border border-app-border mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-semibold text-heading">{editingId ? "Edit Event" : "Add Event"}</h2>
        <button onClick={resetForm} className="text-subtle hover:text-body text-xl">×</button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div><label className="block text-xs font-semibold text-subtle uppercase mb-1">Event Title</label><input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Bouquet Toss" required className="w-full border border-app-border rounded-lg px-3 py-2 bg-surface text-heading" /></div>
        <div className="flex gap-3">
          <div className="flex-1"><label className="block text-xs font-semibold text-subtle uppercase mb-1">Start Time</label><input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required className="w-full border border-app-border rounded-lg px-3 py-2 bg-surface text-heading" /></div>
          <div className="flex-1"><label className="block text-xs font-semibold text-subtle uppercase mb-1">Duration</label><select value={durationMinutes} onChange={e => setDurationMinutes(Number(e.target.value))} className="w-full border border-app-border rounded-lg px-3 py-2 bg-surface text-heading">{DURATION_OPTIONS.map(d => <option key={d} value={d}>{formatDuration(d)}</option>)}</select></div>
        </div>
        <div className="flex gap-3">
          <div className="flex-1"><label className="block text-xs font-semibold text-subtle uppercase mb-1">Category</label><select value={category} onChange={e => setCategory(e.target.value)} className="w-full border border-app-border rounded-lg px-3 py-2 bg-surface text-heading">{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
          <div className="flex-1"><label className="block text-xs font-semibold text-subtle uppercase mb-1">Location</label><input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="Where?" className="w-full border border-app-border rounded-lg px-3 py-2 bg-surface text-heading" /></div>
        </div>
        {vendors.length > 0 && (
          <div><label className="block text-xs font-semibold text-subtle uppercase mb-1">Vendors</label>
            <div className="flex flex-wrap gap-2">{vendors.map(v => (
              <button key={v.id} type="button" onClick={() => toggleVendor(v.id)}
                className={"text-xs px-3 py-1.5 rounded-full border transition-colors " + (selectedVendorIds.includes(v.id) ? "border-transparent text-white" : "text-body border-app-border hover:bg-page-bg")}
                style={selectedVendorIds.includes(v.id) ? { backgroundColor: v.color || "#9B8EC4" } : {}}>
                {v.name}
              </button>
            ))}</div>
          </div>
        )}
        <div><label className="block text-xs font-semibold text-subtle uppercase mb-1">Notes</label><textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Details..." rows={2} className="w-full border border-app-border rounded-lg px-3 py-2 bg-surface text-heading" /></div>
        <div className="flex gap-3">
          <button type="submit" className="flex-1 bg-rose-app text-white py-2 rounded-lg hover:bg-rose-app-hover font-medium">{editingId ? "Save Changes" : "+ Add to Timeline"}</button>
          <button type="button" onClick={resetForm} className="px-4 py-2 border border-app-border rounded-lg text-body hover:bg-page-bg">Cancel</button>
        </div>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen bg-page-bg">
      <div className="max-w-full mx-auto p-4 lg:p-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/dashboard" className="text-rose-app hover:text-rose-app-hover text-sm shrink-0">← Dashboard</Link>
            <h1 className="text-2xl font-bold text-heading truncate">Wedding Day Timeline</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setShowPreview(true)} className="px-3 py-1.5 rounded-lg border border-app-border text-body hover:bg-page-bg text-sm">Preview</button>
            <ThemeSwitcher />
          </div>
        </div>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {timelines.map((tl: any) => (
            <button key={tl.id} onClick={() => { if (tl.id === activeTimelineId) { setShowSettings(!showSettings); setShowManager(false); } else { switchTimeline(tl.id); } }}
              onDoubleClick={async () => { const n = prompt("Rename:", tl.name); if (!n?.trim() || n.trim() === tl.name) return; await supabase.from("timelines").update({ name: n.trim() }).eq("id", tl.id); setTimelines(prev => prev.map(t => t.id === tl.id ? { ...t, name: n.trim() } : t)); if (tl.id === activeTimelineId) setActiveTl((p: any) => p ? { ...p, name: n.trim() } : p); }}
              className={"px-3 py-1 rounded-full text-sm " + (tl.id === activeTimelineId ? "bg-rose-app text-white" : "bg-surface text-body border border-app-border hover:bg-page-bg")}>{tl.name}{tl.date ? ` · ${formatDateShort(tl.date)}` : ""}</button>
          ))}
          <button onClick={() => setShowNewTemplates(true)} className="px-3 py-1 rounded-full text-sm bg-surface text-rose-app border border-rose-app hover:bg-rose-light-bg">+ New</button>
          <button onClick={() => { setShowSettings(!showSettings); setShowManager(false); }} className="px-3 py-1 rounded-full text-sm bg-surface text-subtle border border-app-border hover:bg-page-bg">⏱ Settings</button>
          <button onClick={() => { setShowManager(!showManager); setShowSettings(false); }} className="px-3 py-1 rounded-full text-sm bg-surface text-subtle border border-app-border hover:bg-page-bg">⚙ Manage</button>
        </div>
        {activeTl?.date && <p className="text-sm text-subtle mb-3">{formatDateLong(activeTl.date)}</p>}

        {showSettings && (
          <div ref={settingsPanelRef} className="bg-surface p-4 rounded-lg shadow border border-app-border mb-4">
            <h3 className="font-semibold text-heading mb-3">Timeline Settings</h3>
            <div className="flex gap-4 items-end flex-wrap">
              <div><label className="block text-xs font-semibold text-subtle uppercase mb-1">Date</label><input type="date" value={sDate} onChange={e => setSDate(e.target.value)} className="border border-app-border rounded-lg px-3 py-2 bg-surface text-heading" /></div>
              <div><label className="block text-xs font-semibold text-subtle uppercase mb-1">Start</label><select value={sStartHour} onChange={e => setSStartHour(Number(e.target.value))} className="border border-app-border rounded-lg px-3 py-2 bg-surface text-heading">{Array.from({length:24},(_,i)=><option key={i} value={i}>{formatHourLabel(i)}</option>)}</select></div>
              <div><label className="block text-xs font-semibold text-subtle uppercase mb-1">End</label><select value={sEndHour} onChange={e => setSEndHour(Number(e.target.value))} className="border border-app-border rounded-lg px-3 py-2 bg-surface text-heading">{Array.from({length:25},(_,i)=>i+1).filter(h=>h>sStartHour).map(h=><option key={h} value={h}>{formatHourLabel(h)}</option>)}</select></div>
              <button onClick={saveSettings} className="bg-rose-app text-white px-4 py-2 rounded-lg hover:bg-rose-app-hover text-sm">Save</button>
            </div>
          </div>
        )}
        {showManager && (
          <div className="bg-surface p-4 rounded-lg shadow border border-app-border mb-4">
            <h3 className="font-semibold text-heading mb-3">Manage Timelines</h3>
            <div className="space-y-2">{timelines.map((tl: any) => (
              <div key={tl.id} className="flex items-center justify-between p-2 bg-page-bg rounded-lg">
                <span className="text-sm font-medium text-body">{tl.name}</span>
                <div className="flex gap-2">
                  <button onClick={() => duplicateTimeline(tl.id)} className="text-xs text-blue-600 dark:text-blue-400 px-2 py-1">Duplicate</button>
                  <button onClick={() => deleteTimeline(tl.id)} className="text-xs text-red-500 dark:text-red-400 px-2 py-1">Delete</button>
                </div>
              </div>
            ))}</div>
            <div className="mt-4 pt-3 border-t border-app-border"><button onClick={resetAll} className="text-sm text-red-500 dark:text-red-400">Delete All & Start Over</button></div>
          </div>
        )}

        <div className="flex gap-2 mb-4 flex-wrap">
          <button onClick={() => { if (showForm && !editingId) { resetForm(); } else { resetForm(); setShowForm(true); setSelectedItemId(null); } }} className="bg-rose-app text-white px-4 py-2 rounded-lg hover:bg-rose-app-hover font-medium text-sm">+ Add Event</button>
          <button onClick={() => setFilterCategory("All")} className={"px-3 py-1 rounded-full text-sm " + (filterCategory === "All" ? "bg-foreground text-background" : "bg-surface text-body border border-app-border")}>All ({items.length})</button>
          {CATEGORIES.map(cat => { const c = items.filter(i => i.category === cat).length; if (!c) return null; return <button key={cat} onClick={() => setFilterCategory(cat)} className={"px-3 py-1 rounded-full text-sm flex items-center gap-1 " + (filterCategory === cat ? "bg-foreground text-background" : "bg-surface text-body border border-app-border")}><span className="w-2 h-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[cat] }}></span>{cat} ({c})</button>; })}
        </div>

        {showForm && (
          <div className="lg:hidden fixed inset-0 bg-page-bg z-50 overflow-y-auto p-4">
            {renderForm()}
          </div>
        )}

        <div className="flex gap-6">
          <div className="flex-1 min-w-0">
            <div ref={timelineRef} className="relative select-none" style={{ height: totalHeight + "px" }}>
              {hourLabels.map(({ hour, label, top }) => (
                <div key={hour} className="absolute left-0 right-0" style={{ top: top + "px" }}>
                  <div className="flex items-start"><span className="text-xs font-medium text-subtle w-[55px] text-right pr-2 -mt-2 shrink-0">{label}</span><div className="flex-1 border-t border-app-border"></div></div>
                </div>
              ))}

              {positioned.map((item: LayoutItem) => {
                const bgColor = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.General;
                const endTime = getEndTime(item.start_time, item.duration_minutes);
                const isCompact = item._height < 55;
                const isDragging = dragId === item.id && !pendingDropRef.current;
                const isRemoteDrag = !!remoteDrags[item.id];
                const isSelected = selectedItemId === item.id;
                const vids = eventVendors[item.id] || [];

                // Column positioning: divide the event area (right of hour labels) into columns
                const eventAreaStart = 60; // px for hour labels
                const colSpan = (item as any)._colSpan || 1;
                const gap = item._totalCols > 1 ? 2 : 0;

                return (
                  <div key={item.id}>
                    {isSelected && selectedItem && (
                      <div className="lg:hidden absolute left-[60px] right-0" style={{ top: (item._top - 8) + "px", transform: "translateY(-100%)", zIndex: 40 }}>
                        {renderDetailPanel()}
                      </div>
                    )}
                    <div className="absolute" style={{
                      left: item._totalCols === 1 ? `${eventAreaStart}px` : `calc(${eventAreaStart}px + (100% - ${eventAreaStart}px) * ${item._col / item._totalCols})`,
                      width: item._totalCols === 1 ? `calc(100% - ${eventAreaStart}px)` : `calc((100% - ${eventAreaStart}px) * ${colSpan / item._totalCols} - ${gap}px)`,
                      top: item._top + "px", height: item._height + "px",
                      zIndex: isDragging ? 50 : isRemoteDrag ? 30 : isSelected ? 20 : 10,
                      transition: isDragging ? "none" : isRemoteDrag ? "top 0.2s ease, height 0.2s ease" : "top 0.15s ease, height 0.15s ease",
                    }}>
                      <div
                        className={"h-full rounded-lg shadow-sm border border-app-border hover:shadow-md overflow-hidden flex cursor-pointer " + (isSelected ? "ring-2 ring-rose-400 " : "") + (isDragging ? "shadow-lg ring-2 ring-amber-400 " : "") + (isRemoteDrag ? "ring-2 ring-blue-400 opacity-80 " : "")}
                        style={{ borderLeftWidth: "4px", borderLeftColor: bgColor, backgroundColor: isDragging ? themeColors.surfaces.dragHighlight : themeColors.surfaces.cardBg }}
                        onClick={() => { if (!dragId && !dragMovedRef.current) { setSelectedItemId(isSelected ? null : item.id); setShowForm(false); } }}
                        data-event-card>
                        <div className={"w-6 shrink-0 flex items-center justify-center touch-none " + (isRemoteDrag ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing")}
                          style={{ backgroundColor: bgColor + "30" }}
                          onMouseDown={e => handleDragStart(e, item)} onTouchStart={e => handleDragStart(e, item)}>
                          <span className="text-subtle text-xs">⠿</span>
                        </div>
                        <div className="flex-1 px-2 py-1 overflow-hidden flex flex-col justify-center min-w-0">
                          {isCompact ? (
                            <div className="flex items-center gap-1 overflow-hidden">
                              <span className="text-xs font-bold text-subtle shrink-0">{formatTime(item.start_time)}</span>
                              <span className="font-semibold text-heading text-xs truncate">{item.title}</span>
                              {vids.map(vid => <span key={vid} className="text-xs px-1 rounded shrink-0" style={{ backgroundColor: vendorColor(vid) + "50", fontSize: "10px" }}>{vendorName(vid)}</span>)}
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-subtle">{formatTime(item.start_time)} → {formatTime(endTime)}</span>
                                <span className="text-xs text-subtle">{formatDuration(item.duration_minutes)}</span>
                              </div>
                              <p className="font-semibold text-heading text-sm leading-tight truncate">{item.title}</p>
                              {item._height > 70 && (
                                <div className="flex flex-wrap gap-1 mt-0.5">
                                  {item.location && <span className="text-xs text-subtle">• {item.location}</span>}
                                  {vids.map(vid => <span key={vid} className="text-xs px-1.5 rounded-full" style={{ backgroundColor: vendorColor(vid) + "50" }}>{vendorName(vid)}</span>)}
                                  <span className="text-xs px-1.5 rounded-full" style={{ backgroundColor: bgColor + "40", color: themeColors.surfaces.categoryText }}>{item.category}</span>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {dragId && dragTimeLabel && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-3 py-1.5 rounded-lg shadow-lg text-sm font-medium" style={{ zIndex: 60 }}>
                  {dragTimeLabel}
                </div>
              )}
            </div>

            <div className="mt-8 flex justify-center">
              <button onClick={() => setShowTrash(!showTrash)}
                className={"flex items-center gap-2 px-4 py-2 rounded-lg text-sm " + (showTrash ? "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800" : "bg-page-bg text-subtle hover:bg-surface")}>
                Trash {trashedItems.length > 0 && <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{trashedItems.length}</span>}
              </button>
            </div>
            {showTrash && (
              <div className="mt-4 bg-surface rounded-lg shadow border border-app-border p-4">
                <div className="flex justify-between items-center mb-3"><h3 className="font-semibold text-heading">Trash ({trashedItems.length})</h3>{trashedItems.length > 0 && <button onClick={emptyTrash} className="text-sm text-red-500 dark:text-red-400">Empty</button>}</div>
                {trashedItems.length === 0 ? <p className="text-center text-subtle py-4">Empty</p> : (
                  <div className="space-y-2">{trashedItems.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-page-bg rounded-lg">
                      <div><p className="font-medium text-body">{item.title}</p><p className="text-xs text-subtle">Was at {formatTime(item.start_time)}</p></div>
                      <div className="flex gap-2"><button onClick={() => restoreItem(item.id)} className="text-sm text-blue-600 dark:text-blue-400 px-2 py-1">Restore</button><button onClick={() => permanentDelete(item.id)} className="text-sm text-red-500 dark:text-red-400 px-2 py-1">Delete</button></div>
                    </div>
                  ))}</div>
                )}
              </div>
            )}
          </div>
          {(showForm || selectedItem) && (
            <div className="hidden lg:block w-[340px] shrink-0 sticky top-6 self-start">
              {showForm ? renderForm() : renderDetailPanel()}
            </div>
          )}
        </div>

        {undoItem && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50">
            <span className="text-sm">"{undoItem.title}" trashed</span>
            <button onClick={undoTrash} className="text-rose-300 hover:text-rose-100 font-semibold text-sm">Undo</button>
          </div>
        )}

        {showPreview && (
          <TimelinePreview
            items={items}
            vendors={vendors}
            eventVendors={eventVendors}
            activeTl={activeTl}
            event={event}
            CATEGORY_COLORS={CATEGORY_COLORS}
            onClose={() => setShowPreview(false)}
          />
        )}
      </div>
    </div>
  );
}
