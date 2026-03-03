"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  pointerWithin,
} from "@dnd-kit/core";
import { createClient } from "@/lib/supabase/client";
import { ThemeSwitcher } from "@/components/theme-switcher";
import type {
  SeatingTable,
  SeatingAssignment,
  GuestRecord,
  SeatingGuest,
  SeatingState,
  CanvasViewport,
  TableShape,
  SeatPopoverData,
} from "@/lib/seating/types";
import { isFixture, getTableDimensions, CANVAS_SIZE_PRESETS } from "@/lib/seating/types";
import { ListPanel } from "./components/list-panel";
import { CanvasPanel } from "./components/canvas-panel";
import { GuestDragItem } from "./components/guest-drag-item";
import { TableFormDialog } from "./components/table-form-dialog";
import { PartySeatDialog } from "./components/party-seat-dialog";
import { SeatingPreview } from "./components/seating-preview";

interface SeatingChartProps {
  userId: string;
}

export default function SeatingChart({ userId }: SeatingChartProps) {
  const router = useRouter();
  const supabase = createClient();

  // Core state
  const [tables, setTables] = useState<SeatingTable[]>([]);
  const [assignments, setAssignments] = useState<SeatingAssignment[]>([]);
  const [guests, setGuests] = useState<GuestRecord[]>([]);
  const [eventId, setEventId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // UI state
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState("");
  const [viewport, setViewport] = useState<CanvasViewport>({ offsetX: 20, offsetY: 20, zoom: 0.8, canvasSize: "M" });
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [seatPopover, setSeatPopover] = useState<SeatPopoverData | null>(null);
  const [hoveredDropId, setHoveredDropId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Undo
  const [undoStack, setUndoStack] = useState<SeatingState[]>([]);

  // Dialogs
  const [tableDialog, setTableDialog] = useState<{ open: boolean; table: SeatingTable | null }>({
    open: false,
    table: null,
  });
  const [partyDialog, setPartyDialog] = useState<{
    open: boolean;
    guestId: string;
    tableId: string;
    draggedPmi: number | null;
    draggedPersonName: string;
  } | null>(null);

  // Drag state
  const [activeDragPerson, setActiveDragPerson] = useState<SeatingGuest | null>(null);

  // Realtime state
  const [remoteDrags, setRemoteDrags] = useState<Record<string, { userId: string; guestKey: string }>>(
    {},
  );
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const tabIdRef = useRef(Math.random().toString(36).slice(2) + Date.now().toString(36));
  const lastBroadcastRef = useRef(0);
  const pendingDropRef = useRef(false);
  const remoteDragTimeouts = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // RSVP responses (for party member meal preferences)
  const [rsvpResponses, setRsvpResponses] = useState<Record<string, { dietary_notes?: string | null; party_responses?: { name: string; attending: string; meal_preference?: string | null; dietary_notes?: string | null; needs_highchair?: boolean }[] | null }>>({});

  // Track deleted table IDs for save
  const deletedTableIdsRef = useRef<string[]>([]);

  // ── Escape key handler ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedTableId(null);
        setSeatPopover(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ── Flash notification ──
  const flash = useCallback((msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(""), 3000);
  }, []);

  // ── Undo helpers ──
  const pushUndo = useCallback(() => {
    setUndoStack((prev) => {
      const snapshot: SeatingState = {
        tables: JSON.parse(JSON.stringify(tables)),
        assignments: JSON.parse(JSON.stringify(assignments)),
      };
      const next = [...prev, snapshot];
      if (next.length > 30) next.shift();
      return next;
    });
  }, [tables, assignments]);

  const undo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const snapshot = next.pop()!;
      setTables(snapshot.tables);
      setAssignments(snapshot.assignments);
      setDirty(true);
      return next;
    });
  }, []);

  // ── Data fetcher ──
  const fetchData = useCallback(
    async (eid: string) => {
      const [tablesRes, assignmentsRes, guestsRes, rsvpRes] = await Promise.all([
        supabase.from("seating_tables").select("*").eq("event_id", eid).order("sort_order"),
        supabase.from("seating_assignments").select("*").eq("event_id", eid),
        supabase
          .from("guests")
          .select("id, name, email, rsvp_status, meal_preference, party_members")
          .eq("event_id", eid),
        supabase
          .from("rsvp_responses")
          .select("guest_id, dietary_notes, party_responses")
          .eq("event_id", eid),
      ]);
      setTables(tablesRes.data || []);
      setAssignments(assignmentsRes.data || []);
      setGuests(guestsRes.data || []);

      // Index rsvp responses by guest_id
      const rsvpMap: Record<string, { dietary_notes?: string | null; party_responses?: { name: string; attending: string; meal_preference?: string | null; dietary_notes?: string | null; needs_highchair?: boolean }[] | null }> = {};
      for (const r of rsvpRes.data || []) {
        rsvpMap[r.guest_id] = r;
      }
      setRsvpResponses(rsvpMap);
    },
    [supabase],
  );

  // ── Load data + realtime subscription ──
  useEffect(() => {
    const eid = localStorage.getItem("activeEventId");
    if (!eid) {
      router.push("/");
      return;
    }
    setEventId(eid);

    const load = async () => {
      await fetchData(eid);
      setLoading(false);
    };
    load();

    // Realtime subscription
    const channel = supabase
      .channel(`seating-${eid}`)
      // Sync persistent changes from other tabs/users
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "seating_tables",
          filter: `event_id=eq.${eid}`,
        },
        () => {
          if (pendingDropRef.current) return;
          fetchData(eid);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "seating_assignments",
          filter: `event_id=eq.${eid}`,
        },
        () => {
          if (pendingDropRef.current) return;
          fetchData(eid);
        },
      )
      // Ephemeral drag locking
      .on("broadcast", { event: "drag_move" }, ({ payload }) => {
        if (payload.tabId === tabIdRef.current) return;
        const key = payload.guestKey as string;
        setRemoteDrags((prev) => ({
          ...prev,
          [key]: { userId: payload.userId, guestKey: key },
        }));
        // Auto-expire after 3 seconds
        if (remoteDragTimeouts.current[key]) clearTimeout(remoteDragTimeouts.current[key]);
        remoteDragTimeouts.current[key] = setTimeout(() => {
          setRemoteDrags((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
          });
          delete remoteDragTimeouts.current[key];
        }, 3000);
      })
      .on("broadcast", { event: "drag_end" }, ({ payload }) => {
        if (payload.tabId === tabIdRef.current) return;
        const key = payload.guestKey as string;
        setRemoteDrags((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        if (remoteDragTimeouts.current[key]) {
          clearTimeout(remoteDragTimeouts.current[key]);
          delete remoteDragTimeouts.current[key];
        }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
      // Clear all timeouts
      Object.values(remoteDragTimeouts.current).forEach(clearTimeout);
      remoteDragTimeouts.current = {};
    };
  }, []);

  // ── Expand guests into seable persons ──
  const allPersons: SeatingGuest[] = useMemo(() => {
    const result: SeatingGuest[] = [];
    for (const g of guests) {
      const partySize = 1 + (g.party_members?.length || 0);
      const rsvp = rsvpResponses[g.id];
      result.push({
        guest_id: g.id,
        party_member_index: null,
        display_name: g.name,
        meal_preference: g.meal_preference,
        dietary_notes: rsvp?.dietary_notes || null,
        needs_highchair: false,
        rsvp_status: g.rsvp_status,
        party_label: null,
        party_head_name: g.name,
        party_size: partySize,
      });
      if (g.party_members) {
        g.party_members.forEach((pm, i) => {
          const partyMeal = rsvp?.party_responses?.[i]?.meal_preference || null;
          const partyDietary = rsvp?.party_responses?.[i]?.dietary_notes || null;
          const needsHighchair = rsvp?.party_responses?.[i]?.needs_highchair ?? pm.needs_highchair ?? false;
          result.push({
            guest_id: g.id,
            party_member_index: i,
            display_name: pm.name || `${g.name}'s ${pm.label}`,
            meal_preference: partyMeal,
            dietary_notes: partyDietary,
            needs_highchair: needsHighchair,
            rsvp_status: g.rsvp_status,
            party_label: pm.label,
            party_head_name: g.name,
            party_size: partySize,
          });
        });
      }
    }
    return result;
  }, [guests, rsvpResponses]);

  // ── Compute unassigned + table guests ──
  const assignedSet = useMemo(() => {
    const s = new Set<string>();
    for (const a of assignments) {
      s.add(`${a.guest_id}::${a.party_member_index === null ? "primary" : a.party_member_index}`);
    }
    return s;
  }, [assignments]);

  const unassigned = useMemo(
    () =>
      allPersons.filter(
        (p) =>
          !assignedSet.has(
            `${p.guest_id}::${p.party_member_index === null ? "primary" : p.party_member_index}`,
          ),
      ),
    [allPersons, assignedSet],
  );

  // Sparse array indexed by seat_index — guests[seatIdx] is the person at that seat (or null)
  const tableGuests = useMemo(() => {
    const map = new Map<string, (SeatingGuest | null)[]>();
    for (const t of tables) {
      const bySeat: (SeatingGuest | null)[] = new Array(t.capacity).fill(null);
      const tAssignments = assignments.filter((a) => a.table_id === t.id);
      for (const a of tAssignments) {
        if (a.seat_index == null || a.seat_index >= t.capacity) continue;
        const person = allPersons.find(
          (p) => p.guest_id === a.guest_id && p.party_member_index === a.party_member_index,
        );
        if (person) bySeat[a.seat_index] = person;
      }
      map.set(t.id, bySeat);
    }
    return map;
  }, [tables, assignments, allPersons]);

  const seatedCount = assignedSet.size;
  const totalCount = allPersons.length;

  // ── Remote lock helpers ──
  const isGuestLocked = useCallback(
    (guestId: string, pmi: number | null) => {
      const key = `${guestId}::${pmi === null ? "primary" : pmi}`;
      return !!remoteDrags[key];
    },
    [remoteDrags],
  );

  // ── Assignment helpers ──
  const assignPerson = useCallback(
    (guestId: string, partyMemberIndex: number | null, tableId: string, targetSeatIndex?: number) => {
      pushUndo();
      setAssignments((prev) => {
        // Remove the dragged guest's current assignment
        const filtered = prev.filter(
          (a) => !(a.guest_id === guestId && a.party_member_index === partyMemberIndex),
        );

        let result = filtered;

        if (targetSeatIndex != null) {
          const occupant = result.find(
            (a) => a.table_id === tableId && a.seat_index === targetSeatIndex,
          );
          if (occupant) {
            // Find the seat the dragged guest was in (if any, on same table)
            const draggedPrev = prev.find(
              (a) => a.guest_id === guestId && a.party_member_index === partyMemberIndex && a.table_id === tableId,
            );
            const swapSeat = draggedPrev?.seat_index ?? null;

            if (swapSeat != null) {
              // Same-table swap: occupant moves to the dragged guest's old seat
              result = result.map((a) =>
                a.id === occupant.id ? { ...a, seat_index: swapSeat } : a,
              );
            } else {
              // Dragged guest came from elsewhere — find a free seat for the occupant
              const usedAfter = new Set(
                result.filter((a) => a.table_id === tableId).map((a) => a.seat_index),
              );
              const table = tables.find((t) => t.id === tableId);
              const capacity = table?.capacity ?? 999;
              let freeSeat: number | null = null;
              for (let s = 0; s < capacity; s++) {
                if (s !== targetSeatIndex && !usedAfter.has(s)) {
                  freeSeat = s;
                  break;
                }
              }

              if (freeSeat != null) {
                // Move occupant to free seat
                result = result.map((a) =>
                  a.id === occupant.id ? { ...a, seat_index: freeSeat } : a,
                );
              } else {
                // Table is full — displace occupant back to unassigned
                result = result.filter((a) => a.id !== occupant.id);
              }
            }
          }
        }

        // Pick seat: use target if specified, otherwise first available
        let seatIdx: number;
        if (targetSeatIndex != null) {
          seatIdx = targetSeatIndex;
        } else {
          const usedSeats = new Set(result.filter((a) => a.table_id === tableId).map((a) => a.seat_index));
          seatIdx = 0;
          while (usedSeats.has(seatIdx)) seatIdx++;
        }

        return [
          ...result,
          {
            id: crypto.randomUUID(),
            event_id: eventId || "",
            table_id: tableId,
            guest_id: guestId,
            seat_index: seatIdx,
            label: null,
            party_member_index: partyMemberIndex,
          },
        ];
      });
      setDirty(true);
    },
    [eventId, tables, pushUndo],
  );

  const removeAssignment = useCallback(
    (guestId: string, partyMemberIndex: number | null) => {
      pushUndo();
      setAssignments((prev) =>
        prev.filter(
          (a) => !(a.guest_id === guestId && a.party_member_index === partyMemberIndex),
        ),
      );
      setSeatPopover(null);
      setDirty(true);
    },
    [pushUndo],
  );

  const seatEntireParty = useCallback(
    (guestId: string, tableId: string) => {
      const guest = guests.find((g) => g.id === guestId);
      if (!guest) return;
      pushUndo();

      const persons = allPersons.filter((p) => p.guest_id === guestId);
      setAssignments((prev) => {
        let updated = prev.filter((a) => a.guest_id !== guestId);
        const tableAssigns = updated.filter((a) => a.table_id === tableId);
        const usedSeats = new Set(tableAssigns.map((a) => a.seat_index));
        let seatIdx = 0;

        for (const person of persons) {
          while (usedSeats.has(seatIdx)) seatIdx++;
          updated.push({
            id: crypto.randomUUID(),
            event_id: eventId || "",
            table_id: tableId,
            guest_id: guestId,
            seat_index: seatIdx,
            label: null,
            party_member_index: person.party_member_index,
          });
          usedSeats.add(seatIdx);
          seatIdx++;
        }
        return updated;
      });
      setDirty(true);
    },
    [guests, allPersons, eventId, pushUndo],
  );

  // ── Table management ──
  const addTable = useCallback(
    (data: { name: string; shape: TableShape; capacity: number; color: string | null; rotation: number }) => {
      pushUndo();
      const newTable: SeatingTable = {
        id: crypto.randomUUID(),
        event_id: eventId || "",
        name: data.name,
        shape: data.shape,
        capacity: data.capacity,
        color: data.color,
        custom_width: null,
        custom_height: null,
        rotation: data.rotation,
        position_x: 30 + Math.random() * 40,
        position_y: 30 + Math.random() * 40,
        sort_order: tables.length,
      };
      setTables((prev) => [...prev, newTable]);
      setDirty(true);
    },
    [eventId, tables.length, pushUndo],
  );

  const updateTable = useCallback(
    (tableId: string, data: { name: string; shape: TableShape; capacity: number; color: string | null; rotation: number }) => {
      pushUndo();
      setTables((prev) =>
        prev.map((t) => (t.id === tableId ? { ...t, ...data } : t)),
      );
      // If converted to a fixture, unassign all guests from this table
      if (isFixture(data.shape)) {
        setAssignments((prev) => prev.filter((a) => a.table_id !== tableId));
      }
      setDirty(true);
    },
    [pushUndo],
  );

  const deleteTable = useCallback(
    (tableId: string) => {
      if (!confirm("Delete this table? Its guests will be moved to unassigned.")) return;
      pushUndo();
      setTables((prev) => prev.filter((t) => t.id !== tableId));
      setAssignments((prev) => prev.filter((a) => a.table_id !== tableId));
      deletedTableIdsRef.current.push(tableId);
      if (selectedTableId === tableId) setSelectedTableId(null);
      setDirty(true);
    },
    [pushUndo, selectedTableId],
  );

  const repositionTable = useCallback(
    (tableId: string, x: number, y: number) => {
      setTables((prev) =>
        prev.map((t) => (t.id === tableId ? { ...t, position_x: x, position_y: y } : t)),
      );
      setDirty(true);
    },
    [],
  );

  const handleTableDragEnd = useCallback(
    (tableId: string) => {
      setTables((prev) => {
        const cs = CANVAS_SIZE_PRESETS[viewport.canvasSize];
        const moving = prev.find((t) => t.id === tableId);
        if (!moving) return prev;

        const movingDims = getTableDimensions(moving.shape, moving.capacity, moving.custom_width, moving.custom_height);
        // Seats extend ~34px beyond the table edge (20px offset + 14px dot radius).
        // Two facing tables need ~70px clearance between edges to avoid seat overlap.
        const GAP = 70;

        // Work in canvas-pixel space
        let px = (moving.position_x / 100) * cs.w;
        let py = (moving.position_y / 100) * cs.h;

        // Iteratively push out of any overlapping table (max 20 passes)
        for (let iter = 0; iter < 20; iter++) {
          let resolved = true;

          for (const other of prev) {
            if (other.id === tableId) continue;
            const oDims = getTableDimensions(other.shape, other.capacity, other.custom_width, other.custom_height);
            const oPx = (other.position_x / 100) * cs.w;
            const oPy = (other.position_y / 100) * cs.h;

            const mLeft = px - movingDims.w / 2;
            const mRight = px + movingDims.w / 2;
            const mTop = py - movingDims.h / 2;
            const mBottom = py + movingDims.h / 2;
            const oLeft = oPx - oDims.w / 2;
            const oRight = oPx + oDims.w / 2;
            const oTop = oPy - oDims.h / 2;
            const oBottom = oPy + oDims.h / 2;

            if (mLeft - GAP < oRight && mRight + GAP > oLeft && mTop - GAP < oBottom && mBottom + GAP > oTop) {
              // Overlapping — find the smallest push to clear it
              const pushRight = (oRight + GAP) - mLeft;
              const pushLeft  = (oLeft - GAP) - mRight;
              const pushDown  = (oBottom + GAP) - mTop;
              const pushUp    = (oTop - GAP) - mBottom;

              const options = [
                { dx: pushRight, dy: 0, dist: Math.abs(pushRight) },
                { dx: pushLeft,  dy: 0, dist: Math.abs(pushLeft) },
                { dx: 0, dy: pushDown,  dist: Math.abs(pushDown) },
                { dx: 0, dy: pushUp,    dist: Math.abs(pushUp) },
              ];
              options.sort((a, b) => a.dist - b.dist);

              px += options[0].dx;
              py += options[0].dy;
              resolved = false;
              break; // re-check all tables with updated position
            }
          }

          if (resolved) break;
        }

        // Convert back to percentage, clamped to canvas
        const newX = Math.max(0, Math.min(100, (px / cs.w) * 100));
        const newY = Math.max(0, Math.min(100, (py / cs.h) * 100));

        if (Math.abs(newX - moving.position_x) < 0.001 && Math.abs(newY - moving.position_y) < 0.001) {
          return prev; // no change needed
        }
        return prev.map((t) => (t.id === tableId ? { ...t, position_x: newX, position_y: newY } : t));
      });
    },
    [viewport.canvasSize],
  );

  const resizeTable = useCallback(
    (tableId: string, w: number, h: number) => {
      setTables((prev) =>
        prev.map((t) => (t.id === tableId ? { ...t, custom_width: w, custom_height: h } : t)),
      );
      setDirty(true);
    },
    [],
  );

  // ── DnD helpers ──
  // Parse drag IDs: "guest::guestId::pmi" or "seat-guest::tableId::seatIdx::guestId::pmi"
  const parseDragId = useCallback((id: string): { guestId: string; pmi: number | null } | null => {
    const parts = id.split("::");
    if (parts[0] === "guest") {
      return { guestId: parts[1], pmi: parts[2] === "primary" ? null : parseInt(parts[2]) };
    }
    if (parts[0] === "seat-guest") {
      return { guestId: parts[3], pmi: parts[4] === "primary" ? null : parseInt(parts[4]) };
    }
    return null;
  }, []);

  // ── DnD handlers ──
  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      setSeatPopover(null);
      const parsed = parseDragId(event.active.id.toString());
      if (!parsed) return;
      const { guestId, pmi } = parsed;

      // Check if this guest is locked by another user
      if (isGuestLocked(guestId, pmi)) return;

      const person = allPersons.find(
        (p) => p.guest_id === guestId && p.party_member_index === pmi,
      );
      setActiveDragPerson(person || null);

      // Broadcast drag start
      const guestKey = `${guestId}::${pmi === null ? "primary" : pmi}`;
      if (channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "drag_move",
          payload: { guestKey, userId, tabId: tabIdRef.current },
        });
      }
    },
    [allPersons, isGuestLocked, userId, parseDragId],
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const overId = event.over?.id?.toString() || null;
      setHoveredDropId(overId);

      // Throttled broadcast
      if (activeDragPerson && channelRef.current) {
        const now = Date.now();
        if (now - lastBroadcastRef.current > 200) {
          lastBroadcastRef.current = now;
          const guestKey = `${activeDragPerson.guest_id}::${activeDragPerson.party_member_index === null ? "primary" : activeDragPerson.party_member_index}`;
          channelRef.current.send({
            type: "broadcast",
            event: "drag_move",
            payload: { guestKey, userId, tabId: tabIdRef.current },
          });
        }
      }
    },
    [activeDragPerson, userId],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      // Broadcast drag end
      if (activeDragPerson && channelRef.current) {
        const guestKey = `${activeDragPerson.guest_id}::${activeDragPerson.party_member_index === null ? "primary" : activeDragPerson.party_member_index}`;
        channelRef.current.send({
          type: "broadcast",
          event: "drag_end",
          payload: { guestKey, userId, tabId: tabIdRef.current },
        });
      }

      setActiveDragPerson(null);
      setHoveredDropId(null);
      const { active, over } = event;
      if (!over) return;

      const parsed = parseDragId(active.id.toString());
      if (!parsed) return;
      const { guestId, pmi } = parsed;

      const overId = over.id.toString();

      if (overId === "unassigned") {
        removeAssignment(guestId, pmi);
        return;
      }

      let targetTableId: string | null = null;
      let targetSeatIndex: number | undefined;
      if (overId.startsWith("table::") || overId.startsWith("menu-table::")) {
        targetTableId = overId.split("::")[1];
      } else if (overId.startsWith("seat::")) {
        const seatParts = overId.split("::");
        targetTableId = seatParts[1];
        targetSeatIndex = parseInt(seatParts[2]);
      }

      if (!targetTableId) return;

      const table = tables.find((t) => t.id === targetTableId);
      if (!table) return;

      // Can't drop guests on fixture elements
      if (isFixture(table.shape)) return;

      const alreadyHere = assignments.find(
        (a) =>
          a.table_id === targetTableId &&
          a.guest_id === guestId &&
          a.party_member_index === pmi,
      );

      // If already at this table, only allow if dropping on a specific different seat
      if (alreadyHere) {
        if (targetSeatIndex != null && alreadyHere.seat_index !== targetSeatIndex) {
          assignPerson(guestId, pmi, targetTableId, targetSeatIndex);
        }
        return;
      }

      const guest = guests.find((g) => g.id === guestId);
      if (guest?.party_members && guest.party_members.length > 0) {
        const draggedPerson = allPersons.find(
          (p) => p.guest_id === guestId && p.party_member_index === pmi,
        );
        setPartyDialog({
          open: true,
          guestId,
          tableId: targetTableId,
          draggedPmi: pmi,
          draggedPersonName: draggedPerson?.display_name || guest.name,
        });
        return;
      }

      // If dropping on a specific seat, always allow (occupant will be displaced)
      // If dropping on the table surface, check capacity
      if (targetSeatIndex == null) {
        const currentCount = assignments.filter((a) => a.table_id === targetTableId).length;
        if (currentCount >= table.capacity) {
          flash(`${table.name} is full!`);
          return;
        }
      }

      assignPerson(guestId, pmi, targetTableId, targetSeatIndex);
    },
    [tables, assignments, guests, allPersons, activeDragPerson, assignPerson, removeAssignment, flash, userId, parseDragId],
  );

  // ── Party dialog handlers ──
  const handlePartySeatAll = useCallback(() => {
    if (!partyDialog) return;
    seatEntireParty(partyDialog.guestId, partyDialog.tableId);
    setPartyDialog(null);
  }, [partyDialog, seatEntireParty]);

  const handlePartySeatOne = useCallback(() => {
    if (!partyDialog) return;
    const table = tables.find((t) => t.id === partyDialog.tableId);
    const currentCount = assignments.filter((a) => a.table_id === partyDialog.tableId).length;
    if (table && currentCount >= table.capacity) {
      flash(`${table.name} is full!`);
      setPartyDialog(null);
      return;
    }
    assignPerson(partyDialog.guestId, partyDialog.draggedPmi, partyDialog.tableId);
    setPartyDialog(null);
  }, [partyDialog, tables, assignments, assignPerson, flash]);

  // ── Auto-seat ──
  const autoSeat = useCallback(() => {
    pushUndo();
    const sortedTables = [...tables].filter((t) => !isFixture(t.shape)).sort((a, b) => a.sort_order - b.sort_order);
    let newAssignments = [...assignments];
    let seated = 0;

    const assignedKeys = new Set(
      newAssignments.map(
        (a) => `${a.guest_id}::${a.party_member_index === null ? "primary" : a.party_member_index}`,
      ),
    );
    const seatable = guests.filter((g) => g.rsvp_status !== "declined");

    for (const guest of seatable) {
      const partyPersons = allPersons.filter(
        (p) =>
          p.guest_id === guest.id &&
          !assignedKeys.has(
            `${p.guest_id}::${p.party_member_index === null ? "primary" : p.party_member_index}`,
          ),
      );
      if (partyPersons.length === 0) continue;

      let placed = false;
      for (const table of sortedTables) {
        const tableCount = newAssignments.filter((a) => a.table_id === table.id).length;
        const available = table.capacity - tableCount;
        if (available >= partyPersons.length) {
          const usedSeats = new Set(
            newAssignments.filter((a) => a.table_id === table.id).map((a) => a.seat_index),
          );
          let seatIdx = 0;
          for (const person of partyPersons) {
            while (usedSeats.has(seatIdx)) seatIdx++;
            newAssignments.push({
              id: crypto.randomUUID(),
              event_id: eventId || "",
              table_id: table.id,
              guest_id: person.guest_id,
              seat_index: seatIdx,
              label: null,
              party_member_index: person.party_member_index,
            });
            usedSeats.add(seatIdx);
            assignedKeys.add(
              `${person.guest_id}::${person.party_member_index === null ? "primary" : person.party_member_index}`,
            );
            seated++;
            seatIdx++;
          }
          placed = true;
          break;
        }
      }

      if (!placed) {
        for (const person of partyPersons) {
          for (const table of sortedTables) {
            const tableCount = newAssignments.filter((a) => a.table_id === table.id).length;
            if (tableCount < table.capacity) {
              const usedSeats = new Set(
                newAssignments.filter((a) => a.table_id === table.id).map((a) => a.seat_index),
              );
              let seatIdx = 0;
              while (usedSeats.has(seatIdx)) seatIdx++;
              newAssignments.push({
                id: crypto.randomUUID(),
                event_id: eventId || "",
                table_id: table.id,
                guest_id: person.guest_id,
                seat_index: seatIdx,
                label: null,
                party_member_index: person.party_member_index,
              });
              assignedKeys.add(
                `${person.guest_id}::${person.party_member_index === null ? "primary" : person.party_member_index}`,
              );
              seated++;
              break;
            }
          }
        }
      }
    }

    setAssignments(newAssignments);
    setDirty(true);
    flash(`Auto-seated ${seated} guest${seated !== 1 ? "s" : ""}`);
  }, [tables, assignments, guests, allPersons, eventId, pushUndo, flash]);

  // ── Auto-save (debounced 2s after last change) ──
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSaveRef = useRef<() => Promise<void>>(undefined);

  // ── Save ──
  const handleSave = useCallback(async () => {
    if (!eventId) return;
    setSaving(true);
    pendingDropRef.current = true;

    try {
      if (deletedTableIdsRef.current.length > 0) {
        await supabase
          .from("seating_tables")
          .delete()
          .in("id", deletedTableIdsRef.current);
        deletedTableIdsRef.current = [];
      }

      if (tables.length > 0) {
        const { error: tablesErr } = await supabase.from("seating_tables").upsert(
          tables.map((t) => ({
            id: t.id,
            event_id: eventId,
            name: t.name,
            shape: t.shape,
            capacity: t.capacity,
            color: t.color,
            custom_width: t.custom_width,
            custom_height: t.custom_height,
            rotation: t.rotation,
            position_x: t.position_x,
            position_y: t.position_y,
            sort_order: t.sort_order,
          })),
        );
        if (tablesErr) throw tablesErr;
      }

      await supabase.from("seating_assignments").delete().eq("event_id", eventId);
      if (assignments.length > 0) {
        const { error: assignErr } = await supabase.from("seating_assignments").insert(
          assignments.map((a) => ({
            id: a.id,
            event_id: eventId,
            table_id: a.table_id,
            guest_id: a.guest_id,
            seat_index: a.seat_index,
            label: a.label,
            party_member_index: a.party_member_index,
          })),
        );
        if (assignErr) throw assignErr;
      }

      setDirty(false);
      flash("Saved!");
    } catch (err) {
      console.error("Save failed:", err);
      flash("Save failed — check console");
    } finally {
      setSaving(false);
      pendingDropRef.current = false;
    }
  }, [eventId, tables, assignments, supabase, flash]);

  // Keep ref current so the timeout calls the latest version
  handleSaveRef.current = handleSave;

  useEffect(() => {
    if (!dirty || saving) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      handleSaveRef.current?.();
    }, 2000);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [dirty, saving, tables, assignments]);

  // ── Table dialog handlers ──
  const handleTableSubmit = useCallback(
    (data: { name: string; shape: TableShape; capacity: number; color: string | null; rotation: number }) => {
      if (tableDialog.table) {
        updateTable(tableDialog.table.id, data);
      } else {
        addTable(data);
      }
      setTableDialog({ open: false, table: null });
    },
    [tableDialog, addTable, updateTable],
  );

  // ── Party dialog data ──
  const partyDialogData = useMemo(() => {
    if (!partyDialog) return null;
    const guest = guests.find((g) => g.id === partyDialog.guestId);
    const table = tables.find((t) => t.id === partyDialog.tableId);
    if (!guest || !table) return null;
    const partySize = 1 + (guest.party_members?.length || 0);
    const currentCount = assignments.filter((a) => a.table_id === table.id).length;
    return {
      guestName: guest.name,
      draggedPersonName: partyDialog.draggedPersonName,
      partySize,
      tableName: table.name,
      availableSeats: table.capacity - currentCount,
    };
  }, [partyDialog, guests, tables, assignments]);

  // ── Select table handler ──
  const handleSelectTable = useCallback((tableId: string | null) => {
    setSelectedTableId(tableId);
    setSeatPopover(null);
  }, []);

  // ── Loading state ──
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page-bg">
        <p className="text-subtle">Loading seating chart...</p>
      </div>
    );
  }

  return (
    <DndContext
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="h-screen flex flex-col overflow-hidden bg-page-bg">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-3 border-b border-app-border bg-surface shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/dashboard" className="text-rose-app hover:text-rose-app-hover text-sm shrink-0">← Dashboard</Link>
            <h1 className="text-2xl font-bold text-heading truncate">Seating Chart</h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {notification && (
              <span className="text-sm px-2 py-1 rounded text-rose-app">
                {notification}
              </span>
            )}
            <button
              onClick={() => setShowPreview(true)}
              className="text-sm px-3 py-1.5 rounded-lg border border-app-border text-body hover:bg-page-bg"
              title="Preview printable seating chart"
            >
              Preview
            </button>
            <button
              onClick={autoSeat}
              className="text-sm px-3 py-1.5 rounded-lg border border-app-border text-body hover:bg-page-bg"
              title="Auto-assign all unassigned guests (excludes declined)"
            >
              Auto-seat
            </button>
            <button
              onClick={undo}
              disabled={undoStack.length === 0}
              className="text-sm px-3 py-1.5 rounded-lg border border-app-border text-body disabled:opacity-30"
            >
              Undo{undoStack.length > 0 ? ` (${undoStack.length})` : ""}
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !dirty}
              className="text-sm px-4 py-1.5 rounded-lg font-medium text-white bg-rose-app disabled:opacity-50"
            >
              {saving ? "Saving..." : dirty ? "Save *" : "Saved"}
            </button>
            <ThemeSwitcher />
          </div>
        </header>

        {/* Two-panel layout */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          <ListPanel
            tables={tables}
            unassigned={unassigned}
            tableGuests={tableGuests}
            seatedCount={seatedCount}
            totalCount={totalCount}
            selectedTableId={selectedTableId}
            onAddTable={() => setTableDialog({ open: true, table: null })}
            onEditTable={(t) => setTableDialog({ open: true, table: t })}
            onDeleteTable={deleteTable}
            onRemoveAssignment={removeAssignment}
          />
          <CanvasPanel
            tables={tables}
            tableGuests={tableGuests}
            viewport={viewport}
            selectedTableId={selectedTableId}
            seatPopover={seatPopover}
            dragInitial={activeDragPerson?.display_name.charAt(0).toUpperCase() || null}
            onViewportChange={setViewport}
            onTableRepositioned={repositionTable}
            onTableDragEnd={handleTableDragEnd}
            onTableResized={resizeTable}
            onEditTable={(t) => setTableDialog({ open: true, table: t })}
            onSelectTable={handleSelectTable}
            onSeatClick={setSeatPopover}
            onRemoveAssignment={removeAssignment}
          />
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay dropAnimation={null}>
        {activeDragPerson && (
          <div
            style={{
              opacity: hoveredDropId?.startsWith("seat::") ? 0 : (hoveredDropId?.startsWith("table::") || hoveredDropId?.startsWith("menu-table::")) ? 0.6 : 1,
              transform: hoveredDropId?.startsWith("seat::") ? "scale(0.3)" : (hoveredDropId?.startsWith("table::") || hoveredDropId?.startsWith("menu-table::")) ? "scale(0.85)" : "scale(1)",
              transition: "opacity 0.15s ease, transform 0.15s ease",
              pointerEvents: "none",
            }}
          >
            <GuestDragItem person={activeDragPerson} isOverlay />
          </div>
        )}
      </DragOverlay>

      {/* Table form dialog */}
      {tableDialog.open && (
        <TableFormDialog
          table={tableDialog.table}
          tableCount={tables.length}
          seatedCount={tableDialog.table ? (tableGuests.get(tableDialog.table.id) || []).filter(Boolean).length : 0}
          onSubmit={handleTableSubmit}
          onClose={() => setTableDialog({ open: false, table: null })}
        />
      )}

      {/* Party seat dialog */}
      {partyDialog && partyDialogData && (
        <PartySeatDialog
          guestName={partyDialogData.guestName}
          draggedPersonName={partyDialogData.draggedPersonName}
          partySize={partyDialogData.partySize}
          tableName={partyDialogData.tableName}
          availableSeats={partyDialogData.availableSeats}
          onSeatAll={handlePartySeatAll}
          onSeatOne={handlePartySeatOne}
          onCancel={() => setPartyDialog(null)}
        />
      )}

      {/* Seating chart preview */}
      {showPreview && (
        <SeatingPreview
          tables={tables}
          tableGuests={tableGuests}
          seatedCount={seatedCount}
          totalCount={totalCount}
          onClose={() => setShowPreview(false)}
        />
      )}
    </DndContext>
  );
}
