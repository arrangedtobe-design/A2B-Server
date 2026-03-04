"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import type { SeatingTable, SeatingGuest, SeatPopoverData } from "@/lib/seating/types";
import { isFixture, getTableDimensions } from "@/lib/seating/types";

interface CanvasTableProps {
  table: SeatingTable;
  guests: (SeatingGuest | null)[];
  zoom: number;
  canvasW: number;
  canvasH: number;
  isSelected: boolean;
  dragInitial: string | null;
  onRepositioned: (tableId: string, x: number, y: number) => void;
  onTableDragEnd: (tableId: string) => void;
  onResized: (tableId: string, w: number, h: number) => void;
  onEditTable: (table: SeatingTable) => void;
  onSelect: (tableId: string) => void;
  onSeatClick: (data: SeatPopoverData) => void;
}

function SeatDot({
  tableId,
  index,
  guest,
  style,
  tableColor,
  dragInitial,
  rotation,
  onSeatClick,
}: {
  tableId: string;
  index: number;
  guest: SeatingGuest | null;
  style: React.CSSProperties;
  tableColor: string | null;
  dragInitial: string | null;
  rotation: number;
  onSeatClick: (data: SeatPopoverData) => void;
}) {
  const { setNodeRef: dropRef, isOver } = useDroppable({ id: `seat::${tableId}::${index}` });
  const dragId = guest
    ? `seat-guest::${tableId}::${index}::${guest.guest_id}::${guest.party_member_index === null ? "primary" : guest.party_member_index}`
    : `empty-seat::${tableId}::${index}`;
  const { attributes, listeners, setNodeRef: dragRef, isDragging } = useDraggable({
    id: dragId,
    disabled: !guest,
  });

  const setRefs = useCallback(
    (node: HTMLElement | null) => {
      dropRef(node);
      dragRef(node);
    },
    [dropRef, dragRef],
  );

  const handleClick = (e: React.MouseEvent) => {
    if (!guest) return;
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    onSeatClick({
      tableId,
      seatIndex: index,
      guest,
      anchorX: rect.left + rect.width / 2,
      anchorY: rect.top,
    });
  };

  const occupiedColor = tableColor || "var(--color-rose-app)";
  const isHoverTarget = isOver && !guest;
  const isSwapTarget = isOver && !!guest;
  const [showTooltip, setShowTooltip] = useState(false);

  // Track occupant changes for seat animations
  const guestKey = guest ? `${guest.guest_id}-${guest.party_member_index}` : null;
  const prevGuestKey = useRef(guestKey);
  const [animState, setAnimState] = useState<"idle" | "pop" | "vacated">("idle");

  useEffect(() => {
    if (guestKey !== prevGuestKey.current) {
      const wasOccupied = prevGuestKey.current !== null;
      prevGuestKey.current = guestKey;

      if (guestKey) {
        // New guest arrived at this seat
        setAnimState("pop");
        const timer = setTimeout(() => setAnimState("idle"), 500);
        return () => clearTimeout(timer);
      } else if (wasOccupied) {
        // Guest left this seat
        setAnimState("vacated");
        const timer = setTimeout(() => setAnimState("idle"), 400);
        return () => clearTimeout(timer);
      }
    }
  }, [guestKey]);

  return (
    <div
      ref={setRefs}
      {...(guest ? listeners : {})}
      {...(guest ? attributes : {})}
      onClick={handleClick}
      onMouseEnter={() => guest && setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      className={`absolute rounded-full border-2 flex items-center justify-center text-[9px] font-bold ${
        guest ? "cursor-pointer" : ""
      } ${isDragging ? "opacity-30" : ""}`}
      style={{
        ...style,
        width: isHoverTarget ? 36 : 28,
        height: isHoverTarget ? 36 : 28,
        marginLeft: isHoverTarget ? -4 : 0,
        marginTop: isHoverTarget ? -4 : 0,
        backgroundColor: isHoverTarget
          ? "var(--color-rose-app)"
          : isSwapTarget
            ? "var(--color-rose-app)"
            : guest
              ? occupiedColor
              : "var(--color-page-bg)",
        borderColor: isOver
          ? "var(--color-rose-app)"
          : guest
            ? occupiedColor
            : "var(--color-app-border)",
        color: isHoverTarget || isSwapTarget || guest ? "#fff" : "var(--color-subtle)",
        boxShadow: isHoverTarget
          ? "0 0 14px var(--color-rose-app), 0 0 6px var(--color-rose-app)"
          : isSwapTarget
            ? "0 0 10px var(--color-rose-app), 0 0 4px var(--color-rose-app)"
            : "none",
        transition: animState === "idle" ? "all 0.2s ease" : undefined,
        animation:
          animState === "pop" ? "seat-pop-in 0.5s ease-out" :
          animState === "vacated" ? "seat-vacated 0.4s ease-out" :
          undefined,
        zIndex: isOver || animState !== "idle" || showTooltip ? 10 : undefined,
      }}
    >
      <span style={{ display: "block", transform: rotation ? `rotate(${-rotation}deg)` : undefined }}>
        {isHoverTarget
          ? (dragInitial || "+")
          : isSwapTarget
            ? (dragInitial || guest?.display_name.charAt(0).toUpperCase() || "")
            : guest
              ? guest.display_name.charAt(0).toUpperCase()
              : ""}
      </span>

      {/* Highchair badge */}
      {guest?.needs_highchair && !isDragging && (
        <span
          className="absolute pointer-events-none"
          style={{
            bottom: -2,
            right: -2,
            fontSize: 10,
            lineHeight: 1,
            transform: rotation ? `rotate(${-rotation}deg)` : undefined,
          }}
        >
          🪑
        </span>
      )}

      {/* Hover tooltip — counter-rotate so it always appears above in screen space */}
      {showTooltip && guest && !isDragging && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: "50%",
            top: "50%",
            width: 0,
            height: 0,
            transform: rotation ? `rotate(${-rotation}deg)` : undefined,
            zIndex: 50,
          }}
        >
          <div
            className="absolute px-2.5 py-1.5 rounded-lg shadow-lg border border-app-border bg-surface whitespace-nowrap pointer-events-none"
            style={{
              bottom: 20,
              left: 0,
              transform: "translateX(-50%)",
            }}
          >
            <p className="text-xs font-semibold text-heading">{guest.display_name}</p>
            {guest.party_member_index !== null && (
              <p className="text-[10px] text-subtle">Guest of {guest.party_head_name}</p>
            )}
            {guest.meal_preference && (
              <p className="text-[10px] text-subtle">Meal: {guest.meal_preference}</p>
            )}
            {guest.dietary_notes && (
              <p className="text-[10px] text-subtle">⚠ Dietary: {guest.dietary_notes}</p>
            )}
            {guest.needs_highchair && (
              <p className="text-[10px] text-subtle">🪑 Needs highchair</p>
            )}
            <div
              className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0"
              style={{
                borderLeft: "5px solid transparent",
                borderRight: "5px solid transparent",
                borderTop: "5px solid var(--color-surface)",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

type ResizeHandle = "n" | "s" | "e" | "w" | "nw" | "ne" | "sw" | "se";

const HANDLE_CURSORS: Record<ResizeHandle, string> = {
  nw: "nwse-resize",
  se: "nwse-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
};

const MIN_W = 50;
const MIN_H = 40;

export function CanvasTable({
  table,
  guests,
  zoom,
  canvasW,
  canvasH,
  isSelected,
  dragInitial,
  onRepositioned,
  onTableDragEnd,
  onResized,
  onEditTable,
  onSelect,
  onSeatClick,
}: CanvasTableProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `table::${table.id}` });
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number; moved: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origX: table.position_x,
        origY: table.position_y,
        moved: false,
      };
      setDragging(true);

      // Compute boundary margins so the full table + seats stay inside the canvas
      const dims = getTableDimensions(table.shape, table.capacity, table.custom_width, table.custom_height);
      const seatExt = isFixture(table.shape) ? 0 : 34; // 20px seat offset + 14px dot radius
      const halfExtW = dims.w / 2 + seatExt;
      const halfExtH = dims.h / 2 + seatExt;
      const rotated = table.rotation === 90 || table.rotation === 270;
      const marginXPct = ((rotated ? halfExtH : halfExtW) / canvasW) * 100;
      const marginYPct = ((rotated ? halfExtW : halfExtH) / canvasH) * 100;

      const handleMouseMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        const dx = ev.clientX - dragRef.current.startX;
        const dy = ev.clientY - dragRef.current.startY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          dragRef.current.moved = true;
        }
        const scaledDx = dx / zoom;
        const scaledDy = dy / zoom;
        const newX = Math.max(marginXPct, Math.min(100 - marginXPct, dragRef.current.origX + (scaledDx / canvasW) * 100));
        const newY = Math.max(marginYPct, Math.min(100 - marginYPct, dragRef.current.origY + (scaledDy / canvasH) * 100));
        onRepositioned(table.id, newX, newY);
      };

      const handleMouseUp = () => {
        const wasDrag = dragRef.current?.moved;
        dragRef.current = null;
        setDragging(false);
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
        if (wasDrag) {
          onTableDragEnd(table.id);
        } else {
          onSelect(table.id);
        }
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [table.id, table.position_x, table.position_y, table.shape, table.capacity, table.custom_width, table.custom_height, table.rotation, zoom, canvasW, canvasH, onRepositioned, onTableDragEnd, onSelect],
  );

  const fixture = isFixture(table.shape);
  const seatPositions = fixture ? [] : computeSeatPositions(table.shape, table.capacity);
  const dimensions = getTableDimensions(table.shape, table.capacity, table.custom_width, table.custom_height);
  const guestCount = guests.filter(Boolean).length;

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent, handle: ResizeHandle) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startY = e.clientY;
      const origW = dimensions.w;
      const origH = dimensions.h;
      setResizing(true);

      const handleMouseMove = (ev: MouseEvent) => {
        const dx = (ev.clientX - startX) / zoom;
        const dy = (ev.clientY - startY) / zoom;
        let newW = origW;
        let newH = origH;

        // Double the delta because the element is center-positioned,
        // so both edges move equally — handle must track the cursor.
        if (handle.includes("e")) newW = Math.max(MIN_W, origW + dx * 2);
        if (handle.includes("w")) newW = Math.max(MIN_W, origW - dx * 2);
        if (handle.includes("s")) newH = Math.max(MIN_H, origH + dy * 2);
        if (handle.includes("n")) newH = Math.max(MIN_H, origH - dy * 2);

        onResized(table.id, Math.round(newW), Math.round(newH));
      };

      const handleMouseUp = () => {
        setResizing(false);
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [table.id, dimensions.w, dimensions.h, zoom, onResized],
  );

  // If table surface is visually too small for the text, render label below
  // Fixtures always render text inside the box
  const visualWidth = dimensions.w * zoom;
  const visualHeight = dimensions.h * zoom;
  const textFitsInside = fixture || (visualWidth >= 90 && visualHeight >= 50);

  const borderColor = isSelected
    ? "var(--color-rose-app)"
    : isOver
      ? "var(--color-rose-app)"
      : table.color || "var(--color-app-border)";

  const dropHighlight = isOver && !fixture;
  const surfaceColor = table.color ? `${table.color}18` : "var(--color-surface)";

  const fixtureIcon = FIXTURE_ICON_MAP[table.shape] || "";
  const shapeClass = table.shape === "round" ? "rounded-full"
    : table.shape === "dance_floor" ? "rounded-xl"
    : "rounded-lg";

  return (
    <div
      ref={setNodeRef}
      className="absolute"
      style={{
        left: `calc(${table.position_x}% - ${dimensions.w / 2}px)`,
        top: `calc(${table.position_y}% - ${dimensions.h / 2}px)`,
        width: dimensions.w,
        height: dimensions.h,
        transform: table.rotation ? `rotate(${table.rotation}deg)` : undefined,
        transformOrigin: "center center",
      }}
    >
      {/* Table / fixture surface */}
      <div
        className={`relative border-2 flex items-center justify-center transition-all ${resizing ? "cursor-default" : dragging ? "cursor-grabbing" : "cursor-grab"} ${shapeClass}`}
        style={{
          width: dimensions.w,
          height: dimensions.h,
          backgroundColor: dropHighlight
            ? "hsl(var(--app-rose) / 0.12)"
            : fixture ? (table.color ? `${table.color}25` : "var(--color-page-bg)") : surfaceColor,
          borderColor,
          borderWidth: dropHighlight ? 3 : 2,
          borderStyle: fixture ? "dashed" : "solid",
          boxShadow: dropHighlight
            ? `0 0 0 4px hsl(var(--app-rose) / 0.3), 0 0 24px hsl(var(--app-rose) / 0.25)`
            : isSelected
              ? `0 0 0 3px ${table.color || "var(--color-rose-app)"}40, 0 0 20px ${table.color || "var(--color-rose-app)"}20`
              : "none",
          transform: dropHighlight ? "scale(1.04)" : undefined,
        }}
        onMouseDown={handleMouseDown}
        onDoubleClick={() => onEditTable(table)}
      >
        {textFitsInside && (
          <div
            className="text-center select-none pointer-events-none"
            style={{
              transform: `scale(${1 / zoom}) rotate(${-table.rotation}deg)`,
              transformOrigin: "center center",
            }}
          >
            {fixture && (
              <p className="text-2xl mb-0.5">{fixtureIcon}</p>
            )}
            <p className="text-base font-semibold truncate text-heading" style={{ maxWidth: (dimensions.w - 16) * zoom }}>
              {table.name}
            </p>
            {!fixture && (
              <p className="text-sm text-subtle">
                {guestCount}/{table.capacity}
              </p>
            )}
          </div>
        )}

        {/* Resize handles — only for selected fixtures */}
        {isSelected && fixture && (
          <>
            {(["nw", "ne", "sw", "se", "n", "s", "e", "w"] as ResizeHandle[]).map((handle) => {
              const size = Math.max(8, 10 / zoom);
              const offset = -(size / 2);
              const posStyle: React.CSSProperties = {
                position: "absolute",
                width: size,
                height: size,
                backgroundColor: "var(--color-rose-app)",
                border: "2px solid white",
                borderRadius: handle.length === 2 ? 2 : "50%",
                cursor: HANDLE_CURSORS[handle],
                zIndex: 20,
              };
              // Position each handle
              if (handle.includes("n")) posStyle.top = offset;
              if (handle.includes("s")) posStyle.bottom = offset;
              if (handle.includes("w")) posStyle.left = offset;
              if (handle.includes("e")) posStyle.right = offset;
              // Center edge handles
              if (handle === "n" || handle === "s") { posStyle.left = "50%"; posStyle.marginLeft = offset; }
              if (handle === "e" || handle === "w") { posStyle.top = "50%"; posStyle.marginTop = offset; }

              return (
                <div
                  key={handle}
                  style={posStyle}
                  onMouseDown={(e) => handleResizeMouseDown(e, handle)}
                />
              );
            })}
          </>
        )}
      </div>

      {/* Label above element when zoomed out too far */}
      {!textFitsInside && (() => {
        // Account for rotation: compute visual extent above center in screen space
        const rotRad = (table.rotation * Math.PI) / 180;
        const sinR = Math.sin(rotRad);
        const cosR = Math.cos(rotRad);
        // Visual half-height of table body after rotation
        const bodyAbove = Math.abs(dimensions.w / 2 * sinR) + Math.abs(dimensions.h / 2 * cosR);
        const maxUp = fixture
          ? bodyAbove
          : Math.max(
              bodyAbove,
              ...seatPositions.map((p) => -(p.x * sinR + p.y * cosR) + 14),
            );
        // Add a small gap in canvas px
        const labelBottom = maxUp + 14;
        return (
          <div
            className="absolute select-none pointer-events-none"
            style={{
              left: dimensions.w / 2,
              top: dimensions.h / 2,
              width: 0,
              height: 0,
              transform: `rotate(${-table.rotation}deg)`,
            }}
          >
            <div
              className="text-center whitespace-nowrap"
              style={{
                position: "absolute",
                left: 0,
                bottom: labelBottom,
                transform: `translateX(-50%) scale(${1 / zoom})`,
                transformOrigin: "bottom center",
              }}
            >
              {fixture && <p className="text-lg">{fixtureIcon}</p>}
              <p className="text-sm font-semibold text-heading">{table.name}</p>
              {!fixture && (
                <p className="text-xs text-subtle">
                  {guestCount}/{table.capacity}
                </p>
              )}
            </div>
          </div>
        );
      })()}

      {/* Seats — only for seating shapes */}
      {seatPositions.map((pos, i) => (
        <SeatDot
          key={i}
          tableId={table.id}
          index={i}
          guest={guests[i] || null}
          tableColor={table.color}
          dragInitial={dragInitial}
          rotation={table.rotation}
          onSeatClick={onSeatClick}
          style={{
            left: `calc(50% + ${pos.x}px - 14px)`,
            top: `calc(50% + ${pos.y}px - 14px)`,
          }}
        />
      ))}
    </div>
  );
}

const FIXTURE_ICON_MAP: Record<string, string> = {
  dance_floor: "💃",
  entrance: "🚪",
  vendor: "🎧",
  cake: "🎂",
};

function computeSeatPositions(shape: string, capacity: number): { x: number; y: number }[] {
  const positions: { x: number; y: number }[] = [];
  const dims = getTableDimensions(shape, capacity);

  switch (shape) {
    case "round": {
      const radius = dims.w / 2 + 20;
      for (let i = 0; i < capacity; i++) {
        const angle = (2 * Math.PI * i) / capacity - Math.PI / 2;
        positions.push({
          x: Math.cos(angle) * radius,
          y: Math.sin(angle) * radius,
        });
      }
      break;
    }
    case "rectangular": {
      const topCount = Math.ceil(capacity / 2);
      const bottomCount = capacity - topCount;
      const halfW = dims.w / 2;
      for (let i = 0; i < topCount; i++) {
        const spacing = dims.w / (topCount + 1);
        positions.push({
          x: -halfW + spacing * (i + 1),
          y: -(dims.h / 2 + 20),
        });
      }
      for (let i = 0; i < bottomCount; i++) {
        const spacing = dims.w / (bottomCount + 1);
        positions.push({
          x: -halfW + spacing * (i + 1),
          y: dims.h / 2 + 20,
        });
      }
      break;
    }
    case "head": {
      const halfW = dims.w / 2;
      for (let i = 0; i < capacity; i++) {
        const spacing = dims.w / (capacity + 1);
        positions.push({
          x: -halfW + spacing * (i + 1),
          y: dims.h / 2 + 20,
        });
      }
      break;
    }
  }

  return positions;
}
