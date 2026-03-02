"use client";

import { useCallback, useRef, useState } from "react";
import type { SeatingTable, SeatingGuest, CanvasViewport, SeatPopoverData, CanvasSizePreset } from "@/lib/seating/types";
import { CANVAS_SIZE_PRESETS } from "@/lib/seating/types";
import { CanvasTable } from "./canvas-table";
import { GuestDragItem } from "./guest-drag-item";

interface CanvasPanelProps {
  tables: SeatingTable[];
  tableGuests: Map<string, (SeatingGuest | null)[]>;
  viewport: CanvasViewport;
  selectedTableId: string | null;
  seatPopover: SeatPopoverData | null;
  dragInitial: string | null;
  onViewportChange: (vp: CanvasViewport) => void;
  onTableRepositioned: (tableId: string, x: number, y: number) => void;
  onTableDragEnd: (tableId: string) => void;
  onTableResized: (tableId: string, w: number, h: number) => void;
  onEditTable: (table: SeatingTable) => void;
  onSelectTable: (tableId: string | null) => void;
  onSeatClick: (data: SeatPopoverData) => void;
  onRemoveAssignment: (guestId: string, partyMemberIndex: number | null) => void;
}

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.0;

export function CanvasPanel({
  tables,
  tableGuests,
  viewport,
  selectedTableId,
  seatPopover,
  dragInitial,
  onViewportChange,
  onTableRepositioned,
  onTableDragEnd,
  onTableResized,
  onEditTable,
  onSelectTable,
  onSeatClick,
  onRemoveAssignment,
}: CanvasPanelProps) {
  const sizePreset = CANVAS_SIZE_PRESETS[viewport.canvasSize];
  const CANVAS_W = sizePreset.w;
  const CANVAS_H = sizePreset.h;

  const containerRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{ startX: number; startY: number; origOX: number; origOY: number } | null>(null);
  const [panning, setPanning] = useState(false);

  // Clamp offset so the canvas stays mostly within the viewport
  const clampOffset = useCallback(
    (ox: number, oy: number, z: number) => {
      const container = containerRef.current;
      if (!container) return { ox, oy };
      const rect = container.getBoundingClientRect();
      const scaledW = CANVAS_W * z;
      const scaledH = CANVAS_H * z;
      // Allow panning up to 60px past each edge, no further
      const MARGIN = 60;
      const minOX = Math.min(MARGIN, rect.width - scaledW - MARGIN);
      const maxOX = Math.max(rect.width - scaledW + MARGIN, MARGIN);
      const minOY = Math.min(MARGIN, rect.height - scaledH - MARGIN);
      const maxOY = Math.max(rect.height - scaledH + MARGIN, MARGIN);
      return {
        ox: Math.max(minOX, Math.min(maxOX, ox)),
        oy: Math.max(minOY, Math.min(maxOY, oy)),
      };
    },
    [CANVAS_W, CANVAS_H],
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, viewport.zoom + delta));
      const { ox, oy } = clampOffset(viewport.offsetX, viewport.offsetY, newZoom);
      onViewportChange({ ...viewport, zoom: newZoom, offsetX: ox, offsetY: oy });
    },
    [viewport, onViewportChange, clampOffset],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.target !== e.currentTarget && !(e.target as HTMLElement).dataset.canvasBg) return;
      if (e.button !== 0) return;
      e.preventDefault();

      onSelectTable(null);

      panRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origOX: viewport.offsetX,
        origOY: viewport.offsetY,
      };
      setPanning(true);

      const handleMove = (ev: MouseEvent) => {
        if (!panRef.current) return;
        const dx = ev.clientX - panRef.current.startX;
        const dy = ev.clientY - panRef.current.startY;
        const rawOX = panRef.current.origOX + dx;
        const rawOY = panRef.current.origOY + dy;
        const { ox, oy } = clampOffset(rawOX, rawOY, viewport.zoom);
        onViewportChange({ ...viewport, offsetX: ox, offsetY: oy });
      };

      const handleUp = () => {
        panRef.current = null;
        setPanning(false);
        window.removeEventListener("mousemove", handleMove);
        window.removeEventListener("mouseup", handleUp);
      };

      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
    },
    [viewport, onViewportChange, onSelectTable, clampOffset],
  );

  const fitToView = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (tables.length === 0) {
      // No tables — show the full canvas centered
      const zoomX = rect.width / CANVAS_W;
      const zoomY = rect.height / CANVAS_H;
      const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.min(zoomX, zoomY) * 0.9));
      onViewportChange({
        ...viewport,
        zoom: z,
        offsetX: (rect.width - CANVAS_W * z) / 2,
        offsetY: (rect.height - CANVAS_H * z) / 2,
      });
      return;
    }

    // Bounding box of all tables (in canvas % → px)
    const PADDING = 120; // px padding around content
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const t of tables) {
      const px = (t.position_x / 100) * CANVAS_W;
      const py = (t.position_y / 100) * CANVAS_H;
      minX = Math.min(minX, px - PADDING);
      minY = Math.min(minY, py - PADDING);
      maxX = Math.max(maxX, px + PADDING);
      maxY = Math.max(maxY, py + PADDING);
    }

    const contentW = maxX - minX;
    const contentH = maxY - minY;
    const zoomX = rect.width / contentW;
    const zoomY = rect.height / contentH;
    const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.min(zoomX, zoomY) * 0.9));

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    onViewportChange({
      ...viewport,
      zoom: z,
      offsetX: rect.width / 2 - centerX * z,
      offsetY: rect.height / 2 - centerY * z,
    });
  }, [tables, viewport, onViewportChange]);

  const zoomIn = () => onViewportChange({ ...viewport, zoom: Math.min(MAX_ZOOM, viewport.zoom + 0.15) });
  const zoomOut = () => onViewportChange({ ...viewport, zoom: Math.max(MIN_ZOOM, viewport.zoom - 0.15) });

  const selectedTable = selectedTableId ? tables.find((t) => t.id === selectedTableId) : null;
  const selectedSeatArray = selectedTableId ? tableGuests.get(selectedTableId) || [] : [];
  const selectedGuests = selectedSeatArray.filter((g): g is SeatingGuest => g !== null);

  return (
    <div
      ref={containerRef}
      className={`flex-1 relative overflow-hidden bg-page-bg ${panning ? "cursor-grabbing" : "cursor-default"}`}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
    >
      {/* Grid pattern background */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        data-canvas-bg="true"
        style={{
          backgroundImage: "radial-gradient(circle, var(--color-heading) 1px, transparent 1px)",
          backgroundSize: `${30 * viewport.zoom}px ${30 * viewport.zoom}px`,
          backgroundPosition: `${viewport.offsetX}px ${viewport.offsetY}px`,
        }}
      />

      {/* Empty state message — outside canvas plane so it doesn't scale */}
      {tables.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10" data-canvas-bg="true">
          <p className="text-xl text-subtle">
            Add tables from the left panel to get started
          </p>
        </div>
      )}

      {/* Canvas plane */}
      <div
        data-canvas-bg="true"
        className="absolute rounded-lg border border-app-border bg-surface"
        style={{
          width: CANVAS_W,
          height: CANVAS_H,
          transform: `translate(${viewport.offsetX}px, ${viewport.offsetY}px) scale(${viewport.zoom})`,
          transformOrigin: "0 0",
        }}
      >
        {tables.map((table) => (
          <CanvasTable
            key={table.id}
            table={table}
            guests={tableGuests.get(table.id) || []}
            zoom={viewport.zoom}
            canvasW={CANVAS_W}
            canvasH={CANVAS_H}
            isSelected={table.id === selectedTableId}
            dragInitial={dragInitial}
            onRepositioned={onTableRepositioned}
            onTableDragEnd={onTableDragEnd}
            onResized={onTableResized}
            onEditTable={onEditTable}
            onSelect={onSelectTable}
            onSeatClick={onSeatClick}
          />
        ))}
      </div>

      {/* Table detail panel */}
      {selectedTable && (
        <div
          className="absolute bottom-16 right-4 w-72 max-h-[50%] rounded-xl border shadow-lg overflow-hidden flex flex-col z-10 bg-surface"
          style={{
            borderColor: selectedTable.color || "var(--color-app-border)",
          }}
        >
          {/* Header */}
          <div
            className="px-4 py-3 border-b border-app-border flex items-center justify-between shrink-0"
            style={{
              backgroundColor: selectedTable.color ? `${selectedTable.color}15` : undefined,
            }}
          >
            <div className="flex items-center gap-2">
              {selectedTable.color && (
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedTable.color }} />
              )}
              <span className="font-semibold text-base text-heading">
                {selectedTable.name}
              </span>
            </div>
            <span className="text-sm text-subtle">
              {selectedGuests.length}/{selectedTable.capacity}
            </span>
          </div>

          {/* Guest list */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {selectedGuests.map((person) => (
              <div
                key={`${person.guest_id}-${person.party_member_index}`}
                className="flex items-center gap-1"
              >
                <div className="flex-1">
                  <GuestDragItem person={person} />
                </div>
                <button
                  onClick={() => onRemoveAssignment(person.guest_id, person.party_member_index)}
                  className="text-sm px-1.5 text-red-400 hover:text-red-600 shrink-0"
                  title="Remove from table"
                >
                  ×
                </button>
              </div>
            ))}
            {Array.from({ length: selectedTable.capacity - selectedGuests.length }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="px-3 py-2 rounded-md border border-dashed border-app-border text-sm text-center text-subtle"
              >
                Empty
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Seat popover */}
      {seatPopover && (
        <div
          className="fixed z-50 w-52 rounded-lg border border-app-border bg-surface shadow-lg p-3"
          style={{
            left: seatPopover.anchorX - 104,
            top: seatPopover.anchorY - 8,
            transform: "translateY(-100%)",
          }}
        >
          <p className="font-semibold text-sm text-heading mb-0.5">
            {seatPopover.guest.display_name}
          </p>
          {seatPopover.guest.party_member_index !== null && (
            <p className="text-xs text-subtle mb-0.5">
              Guest of {seatPopover.guest.party_head_name}
            </p>
          )}
          {seatPopover.guest.party_label && (
            <p className="text-xs text-subtle mb-0.5">
              {seatPopover.guest.party_label}
            </p>
          )}
          {seatPopover.guest.meal_preference && (
            <p className="text-xs text-subtle mb-2">
              Meal: {seatPopover.guest.meal_preference}
            </p>
          )}
          {!seatPopover.guest.meal_preference && <div className="mb-1.5" />}
          <button
            onClick={() =>
              onRemoveAssignment(seatPopover.guest.guest_id, seatPopover.guest.party_member_index)
            }
            className="w-full text-sm py-1.5 rounded-md border border-app-border text-red-500 hover:bg-red-50 transition-colors"
          >
            Remove from table
          </button>
        </div>
      )}

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 flex items-center gap-1 px-3 py-2 rounded-lg border border-app-border bg-surface shadow-sm z-10">
        <button
          onClick={zoomOut}
          className="w-8 h-8 flex items-center justify-center rounded text-base font-bold text-heading hover:bg-black/5 dark:hover:bg-white/10"
        >
          −
        </button>
        <span className="text-sm w-12 text-center text-subtle">
          {Math.round(viewport.zoom * 100)}%
        </span>
        <button
          onClick={zoomIn}
          className="w-8 h-8 flex items-center justify-center rounded text-base font-bold text-heading hover:bg-black/5 dark:hover:bg-white/10"
        >
          +
        </button>
        <div className="w-px h-5 mx-1 bg-app-border" />
        <button
          onClick={fitToView}
          className="text-xs px-2 py-1 rounded text-subtle hover:bg-black/5 dark:hover:bg-white/10"
          title="Fit entire plan to view"
        >
          Fit
        </button>
        <div className="w-px h-5 mx-1 bg-app-border" />
        <select
          value={viewport.canvasSize}
          onChange={(e) =>
            onViewportChange({ ...viewport, canvasSize: e.target.value as CanvasSizePreset })
          }
          className="text-xs px-1 py-1 rounded bg-transparent text-subtle cursor-pointer outline-none"
          title="Canvas size"
        >
          {(Object.keys(CANVAS_SIZE_PRESETS) as CanvasSizePreset[]).map((key) => (
            <option key={key} value={key}>
              {CANVAS_SIZE_PRESETS[key].label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
