"use client";

import { useEffect, useRef, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import type { SeatingTable, SeatingGuest } from "@/lib/seating/types";
import { isFixture } from "@/lib/seating/types";
import { GuestDragItem } from "./guest-drag-item";

interface ListPanelProps {
  tables: SeatingTable[];
  unassigned: SeatingGuest[];
  tableGuests: Map<string, (SeatingGuest | null)[]>;
  seatedCount: number;
  totalCount: number;
  selectedTableId: string | null;
  onAddTable: () => void;
  onEditTable: (table: SeatingTable) => void;
  onDeleteTable: (tableId: string) => void;
  onRemoveAssignment: (guestId: string, partyMemberIndex: number | null) => void;
}

function UnassignedPool({ guests }: { guests: SeatingGuest[] }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "confirmed" | "pending">("all");
  const { setNodeRef, isOver } = useDroppable({ id: "unassigned" });

  const filtered = guests.filter((g) => {
    if (search && !g.display_name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "confirmed" && g.rsvp_status !== "confirmed") return false;
    if (filter === "pending" && g.rsvp_status !== "pending") return false;
    return true;
  });

  const groups: { head: string; members: SeatingGuest[] }[] = [];
  const seen = new Set<string>();
  for (const g of filtered) {
    const key = g.guest_id;
    if (seen.has(key)) continue;
    const party = filtered.filter((p) => p.guest_id === key);
    groups.push({ head: g.party_head_name, members: party });
    seen.add(key);
  }

  const filters: { value: typeof filter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "confirmed", label: "Confirmed" },
    { value: "pending", label: "Pending" },
  ];

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border border-app-border bg-page-bg p-3 transition-colors ${isOver ? "ring-2 ring-rose-app" : ""}`}
    >
      <h3 className="text-sm font-semibold text-heading mb-2">
        Unassigned ({guests.length})
      </h3>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search guests..."
        className="w-full px-3 py-2 rounded-md border border-app-border bg-surface text-sm text-body mb-2"
      />

      <div className="flex gap-1 mb-2">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
              filter === f.value
                ? "border-rose-app bg-rose-app text-white"
                : "border-app-border text-subtle"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="space-y-1 max-h-[300px] overflow-y-auto">
        {groups.length === 0 && (
          <p className="text-sm py-3 text-center text-subtle">
            {guests.length === 0 ? "All guests seated!" : "No matches"}
          </p>
        )}
        {groups.map((group) => (
          <div key={group.head}>
            {group.members.map((person) => (
              <div key={`${person.guest_id}-${person.party_member_index}`} className="mb-1">
                <GuestDragItem person={person} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function TableListItem({
  table,
  guests,
  isSelected,
  onEdit,
  onDelete,
  onRemove,
}: {
  table: SeatingTable;
  guests: SeatingGuest[];
  isSelected: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onRemove: (guestId: string, pmi: number | null) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const { setNodeRef, isOver } = useDroppable({ id: `menu-table::${table.id}` });
  const itemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isSelected && itemRef.current) {
      itemRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [isSelected]);

  const shapeIconMap: Record<string, string> = {
    round: "⭕",
    head: "━━",
    rectangular: "▬",
    dance_floor: "💃",
    entrance: "🚪",
    vendor: "🎧",
    cake: "🎂",
  };
  const shapeIcon = shapeIconMap[table.shape] || "▬";
  const highlightColor = table.color || undefined;
  const fixture = isFixture(table.shape);
  const isFull = guests.length >= table.capacity;
  const isDropTarget = isOver && !fixture;

  return (
    <div
      ref={(node) => {
        if (!fixture) setNodeRef(node);
        (itemRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }}
      className={`rounded-lg border overflow-hidden transition-all bg-surface`}
      style={{
        borderColor: isDropTarget
          ? isFull ? "#ef4444" : "var(--color-rose-app)"
          : isSelected
            ? highlightColor || "var(--color-rose-app)"
            : undefined,
        boxShadow: isDropTarget
          ? isFull
            ? "0 0 0 2px #ef4444, 0 0 12px #ef444440"
            : "0 0 0 2px var(--color-rose-app), 0 0 12px hsl(var(--app-rose) / 0.3)"
          : isSelected
            ? `0 0 0 1px ${highlightColor || "var(--color-rose-app)"}, 0 0 12px ${highlightColor || "var(--color-rose-app)"}30`
            : "none",
        transform: isDropTarget && !isFull ? "scale(1.02)" : undefined,
        animation: isSelected && !isDropTarget ? "pulse-highlight 2s ease-in-out infinite" : "none",
      }}
    >
      <div
        className="flex items-center gap-2 px-3 py-2.5 cursor-pointer"
        onClick={() => !fixture && setExpanded(!expanded)}
      >
        {table.color && (
          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: table.color }} />
        )}
        <span className="text-sm">{shapeIcon}</span>
        <span className="font-semibold text-sm flex-1 truncate text-heading">
          {table.name}
        </span>
        {!fixture && (
          <span className={`text-sm ${isDropTarget && isFull ? "text-red-500 font-semibold" : "text-subtle"}`}>
            {isDropTarget && isFull ? "Full! " : ""}{guests.length}/{table.capacity}
          </span>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="text-xs px-2 py-0.5 rounded text-subtle hover:bg-black/5"
        >
          Edit
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="text-xs px-2 py-0.5 rounded text-red-500 hover:bg-red-500/10"
        >
          Del
        </button>
        {!fixture && <span className="text-sm text-subtle">{expanded ? "▾" : "▸"}</span>}
      </div>

      {!fixture && expanded && (
        <div className="px-3 pb-2.5 space-y-1">
          {guests.length === 0 && (
            <p className="text-sm py-2 text-center text-subtle">Drop guests here</p>
          )}
          {guests.map((person) => (
            <div
              key={`${person.guest_id}-${person.party_member_index}`}
              className="flex items-center gap-1"
            >
              <div className="flex-1">
                <GuestDragItem person={person} />
              </div>
              <button
                onClick={() => onRemove(person.guest_id, person.party_member_index)}
                className="text-sm px-1.5 text-red-400 hover:text-red-600 shrink-0"
                title="Remove from table"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Capacity bar — only for seating tables */}
      {!fixture && (
        <div className="h-1.5 bg-page-bg">
          <div
            className="h-full transition-all"
            style={{
              width: `${Math.min(100, (guests.length / table.capacity) * 100)}%`,
              backgroundColor:
                isFull ? "#ef4444" : table.color || "var(--color-rose-app)",
            }}
          />
        </div>
      )}
    </div>
  );
}

export function ListPanel({
  tables,
  unassigned,
  tableGuests,
  seatedCount,
  totalCount,
  selectedTableId,
  onAddTable,
  onEditTable,
  onDeleteTable,
  onRemoveAssignment,
}: ListPanelProps) {
  return (
    <div className="w-full md:w-[380px] md:shrink-0 border-r border-app-border bg-surface flex flex-col overflow-hidden">
      {/* Stats */}
      <div className="px-4 py-4 border-b border-app-border flex items-center gap-4">
        <div className="text-center flex-1">
          <p className="text-2xl font-bold text-heading">{seatedCount}</p>
          <p className="text-xs uppercase tracking-wide text-subtle">Seated</p>
        </div>
        <div className="text-center flex-1">
          <p className="text-2xl font-bold text-heading">{totalCount - seatedCount}</p>
          <p className="text-xs uppercase tracking-wide text-subtle">Unseated</p>
        </div>
        <div className="text-center flex-1">
          <p className="text-2xl font-bold text-heading">{tables.length}</p>
          <p className="text-xs uppercase tracking-wide text-subtle">Tables</p>
        </div>
      </div>

      {/* Add table button */}
      <div className="px-4 py-3">
        <button
          onClick={onAddTable}
          className="w-full py-2.5 text-sm rounded-lg font-semibold text-white bg-rose-app"
        >
          + Add Table
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
        <UnassignedPool guests={unassigned} />

        {tables
          .slice()
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((table) => (
            <TableListItem
              key={table.id}
              table={table}
              guests={(tableGuests.get(table.id) || []).filter((g): g is SeatingGuest => g !== null)}
              isSelected={table.id === selectedTableId}
              onEdit={() => onEditTable(table)}
              onDelete={() => onDeleteTable(table.id)}
              onRemove={onRemoveAssignment}
            />
          ))}
      </div>
    </div>
  );
}
