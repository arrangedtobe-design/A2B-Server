"use client";

import { useDraggable } from "@dnd-kit/core";
import type { SeatingGuest } from "@/lib/seating/types";

interface GuestDragItemProps {
  person: SeatingGuest;
  isOverlay?: boolean;
}

export function GuestDragItem({ person, isOverlay }: GuestDragItemProps) {
  const dragId = `guest::${person.guest_id}::${person.party_member_index === null ? "primary" : person.party_member_index}`;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: dragId });

  const isPartyMember = person.party_member_index !== null;

  return (
    <div
      ref={isOverlay ? undefined : setNodeRef}
      {...(isOverlay ? {} : listeners)}
      {...(isOverlay ? {} : attributes)}
      className={`flex items-center gap-2 px-3 py-2 rounded-md border bg-surface text-sm cursor-grab active:cursor-grabbing select-none ${
        isPartyMember ? "border-dashed border-app-border ml-3" : "border-app-border"
      } ${isDragging ? "opacity-30" : ""} ${isOverlay ? "shadow-lg" : ""}`}
      style={
        isOverlay
          ? undefined
          : {
              animation: "guest-card-in 0.25s ease-out",
            }
      }
    >
      <div className="flex flex-col flex-1 min-w-0">
        <span className="truncate text-heading">{person.display_name}</span>
        {isPartyMember && (
          <span className="text-[11px] text-subtle truncate">
            Guest of {person.party_head_name}
          </span>
        )}
      </div>
      {person.party_label && (
        <span className="text-xs px-1.5 py-0.5 rounded-full shrink-0 bg-rose-app text-white">
          {person.party_label}
        </span>
      )}
      {person.meal_preference && (
        <span className="text-xs px-1.5 py-0.5 rounded shrink-0 text-subtle border border-app-border">
          {person.meal_preference}
        </span>
      )}
    </div>
  );
}
