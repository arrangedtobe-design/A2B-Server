"use client";

import { useState } from "react";
import type { TableShape, SeatingTable } from "@/lib/seating/types";
import { TABLE_COLORS, isFixture } from "@/lib/seating/types";

interface TableFormDialogProps {
  table?: SeatingTable | null;
  tableCount: number;
  seatedCount: number;
  onSubmit: (data: { name: string; shape: TableShape; capacity: number; color: string | null; rotation: number }) => void;
  onClose: () => void;
}

const seatingShapes: { value: TableShape; label: string; icon: string }[] = [
  { value: "round", label: "Round", icon: "⭕" },
  { value: "rectangular", label: "Rect", icon: "▬" },
  { value: "head", label: "Head", icon: "━━" },
];

const fixtureShapes: { value: TableShape; label: string; icon: string }[] = [
  { value: "dance_floor", label: "Dance Floor", icon: "💃" },
  { value: "entrance", label: "Entrance", icon: "🚪" },
  { value: "vendor", label: "Vendor/DJ", icon: "🎧" },
  { value: "cake", label: "Cake", icon: "🎂" },
];

const DEFAULT_NAMES: Record<string, string> = {
  round: "Table",
  rectangular: "Table",
  head: "Head Table",
  dance_floor: "Dance Floor",
  entrance: "Entrance",
  vendor: "DJ",
  cake: "Cake",
};

// All auto-generated names (used to detect if user has customized the name)
function isAutoName(n: string): boolean {
  const lower = n.toLowerCase().trim();
  return (
    /^table \d+$/.test(lower) ||
    Object.values(DEFAULT_NAMES).some((d) => lower === d.toLowerCase()) ||
    /^(entrance|table|head table|dj|dance floor|cake) ?\d*$/.test(lower)
  );
}

export function TableFormDialog({ table, tableCount, seatedCount, onSubmit, onClose }: TableFormDialogProps) {
  const defaultName = !table ? `Table ${tableCount + 1}` : table.name;
  const [name, setName] = useState(defaultName);
  const [shape, setShape] = useState<TableShape>(table?.shape || "round");
  const [capacity, setCapacity] = useState(table?.capacity || 8);
  const [color, setColor] = useState<string | null>(table?.color || null);
  const [rotation, setRotation] = useState(table?.rotation || 0);

  const fixture = isFixture(shape);

  const handleShapeChange = (newShape: TableShape) => {
    setShape(newShape);
    // Auto-update name if user hasn't customized it
    if (isAutoName(name)) {
      const base = DEFAULT_NAMES[newShape] || "Table";
      if (isFixture(newShape)) {
        setName(base);
      } else {
        setName(`${base} ${tableCount + 1}`);
      }
    }
    // Reset rotation if new shape doesn't support it
    if (newShape !== "rectangular" && newShape !== "head" && newShape !== "vendor") {
      setRotation(0);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      shape,
      capacity: fixture ? 0 : capacity,
      color,
      rotation,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md p-6 rounded-xl shadow-xl border border-app-border bg-surface max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold text-heading mb-4">
          {table ? "Edit Element" : "Add Element"}
        </h3>

        {/* Name */}
        <label className="block text-sm font-medium text-heading mb-1">
          Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={fixture ? "e.g. Dance Floor" : "e.g. Table 1"}
          autoFocus
          className="w-full px-3 py-2.5 rounded-lg border border-app-border bg-page-bg text-sm text-body mb-4"
        />

        {/* Seating Shapes */}
        <label className="block text-sm font-medium text-heading mb-2">
          Tables
        </label>
        <div className="flex gap-2 mb-3">
          {seatingShapes.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => handleShapeChange(s.value)}
              className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium border-2 transition-colors ${
                shape === s.value
                  ? "border-rose-app bg-rose-app text-white"
                  : "border-app-border bg-page-bg text-body"
              }`}
            >
              <span className="block text-lg mb-0.5">{s.icon}</span>
              {s.label}
            </button>
          ))}
        </div>

        {/* Floor Plan Shapes */}
        <label className="block text-sm font-medium text-heading mb-2">
          Floor Plan
        </label>
        <div className="flex gap-2 mb-4">
          {fixtureShapes.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => handleShapeChange(s.value)}
              className={`flex-1 py-2.5 px-2 rounded-lg text-sm font-medium border-2 transition-colors ${
                shape === s.value
                  ? "border-rose-app bg-rose-app text-white"
                  : "border-app-border bg-page-bg text-body"
              }`}
            >
              <span className="block text-lg mb-0.5">{s.icon}</span>
              <span className="text-xs">{s.label}</span>
            </button>
          ))}
        </div>

        {/* Capacity — only for seating shapes */}
        {!fixture && (
          <>
            <label className="block text-sm font-medium text-heading mb-1">
              Seats
            </label>
            <input
              type="number"
              value={capacity}
              onChange={(e) => {
                const val = Math.max(1, parseInt(e.target.value) || 1);
                setCapacity(Math.max(val, table ? seatedCount : 1));
              }}
              min={table ? seatedCount : 1}
              max={30}
              className={`w-full px-3 py-2.5 rounded-lg border text-sm text-body ${
                capacity <= seatedCount && seatedCount > 0
                  ? "border-red-400 bg-red-50 dark:bg-red-950/20"
                  : "border-app-border bg-page-bg"
              }`}
            />
            {table && seatedCount > 0 && capacity <= seatedCount && (
              <p className="text-xs text-red-500 mt-1">
                {seatedCount} guest{seatedCount !== 1 ? "s" : ""} seated — remove guests to lower below {seatedCount}
              </p>
            )}
            <div className="mb-4" />
          </>
        )}

        {/* Color */}
        <label className="block text-sm font-medium text-heading mb-2">
          Color
        </label>
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            type="button"
            onClick={() => setColor(null)}
            className={`w-9 h-9 rounded-full border-2 flex items-center justify-center text-xs bg-page-bg text-subtle ${
              color === null ? "border-heading" : "border-app-border"
            }`}
          >
            ∅
          </button>
          {TABLE_COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setColor(c.value)}
              className="w-9 h-9 rounded-full border-2 transition-transform hover:scale-110"
              style={{
                backgroundColor: c.value,
                borderColor: color === c.value ? "var(--color-heading)" : "transparent",
                boxShadow: color === c.value ? `0 0 0 2px ${c.value}40` : "none",
              }}
              title={c.label}
            />
          ))}
        </div>

        {/* Rotation — only for rectangular, head, and vendor/DJ */}
        {(shape === "rectangular" || shape === "head" || shape === "vendor") && (
          <>
            <label className="block text-sm font-medium text-heading mb-2">
              Rotation
            </label>
            <div className="flex gap-2 mb-4">
              {[0, 90, 180, 270].map((deg) => (
                <button
                  key={deg}
                  type="button"
                  onClick={() => setRotation(deg)}
                  className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium border-2 transition-colors ${
                    rotation === deg
                      ? "border-rose-app bg-rose-app text-white"
                      : "border-app-border bg-page-bg text-body"
                  }`}
                >
                  {deg === 0 ? "0°" : `${deg}°`}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-end mt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-app-border text-body"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim()}
            className="px-4 py-2 text-sm rounded-lg font-medium text-white bg-rose-app disabled:opacity-50"
          >
            {table ? "Save" : fixture ? "Add Element" : "Add Table"}
          </button>
        </div>
      </form>
    </div>
  );
}
