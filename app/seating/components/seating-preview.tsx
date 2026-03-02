"use client";

import { useRef } from "react";
import type { SeatingTable, SeatingGuest } from "@/lib/seating/types";
import { isFixture } from "@/lib/seating/types";

interface SeatingPreviewProps {
  tables: SeatingTable[];
  tableGuests: Map<string, (SeatingGuest | null)[]>;
  seatedCount: number;
  totalCount: number;
  onClose: () => void;
}

const FIXTURE_ICONS: Record<string, string> = {
  dance_floor: "💃",
  entrance: "🚪",
  vendor: "🎧",
  cake: "🎂",
};

const SHAPE_LABELS: Record<string, string> = {
  round: "Round",
  rectangular: "Rectangular",
  head: "Head Table",
  dance_floor: "Dance Floor",
  entrance: "Entrance",
  vendor: "Vendor/DJ",
  cake: "Cake Table",
};

export function SeatingPreview({
  tables,
  tableGuests,
  seatedCount,
  totalCount,
  onClose,
}: SeatingPreviewProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const seatingTables = tables.filter((t) => !isFixture(t.shape));
  const fixtures = tables.filter((t) => isFixture(t.shape));

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/60">
      {/* Toolbar — hidden when printing */}
      <div className="flex items-center justify-between px-6 py-3 bg-surface border-b border-app-border shrink-0 print:hidden">
        <h2 className="text-lg font-bold text-heading">Seating Chart Preview</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrint}
            className="text-sm px-4 py-1.5 rounded-lg font-medium text-white bg-rose-app"
          >
            Print / Export
          </button>
          <button
            onClick={onClose}
            className="text-sm px-3 py-1.5 rounded-lg border border-app-border text-body"
          >
            Close
          </button>
        </div>
      </div>

      {/* Scrollable preview area */}
      <div className="flex-1 overflow-auto p-6 print:p-0 print:overflow-visible">
        <div
          ref={printRef}
          className="max-w-[1100px] mx-auto bg-white text-black rounded-lg shadow-xl print:shadow-none print:rounded-none print:max-w-none"
          style={{ aspectRatio: "11 / 8.5" }}
        >
          <div className="p-8 print:p-10">
            {/* Header */}
            <div className="text-center mb-8 border-b-2 border-gray-200 pb-6">
              <h1 className="text-3xl font-bold tracking-tight mb-1">Seating Chart</h1>
              <p className="text-sm text-gray-500">
                {seatedCount} of {totalCount} guests seated &middot; {seatingTables.length} table{seatingTables.length !== 1 ? "s" : ""}
              </p>
            </div>

            {/* Table grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
              {seatingTables
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((table) => {
                  const guests = (tableGuests.get(table.id) || []).filter((g): g is SeatingGuest => g !== null);
                  const emptySeats = table.capacity - guests.length;
                  return (
                    <div
                      key={table.id}
                      className="rounded-lg border-2 overflow-hidden"
                      style={{
                        borderColor: table.color || "#d1d5db",
                      }}
                    >
                      {/* Table header */}
                      <div
                        className="px-3 py-2 flex items-center justify-between"
                        style={{
                          backgroundColor: table.color ? `${table.color}20` : "#f9fafb",
                        }}
                      >
                        <div className="flex items-center gap-2">
                          {table.color && (
                            <div
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: table.color }}
                            />
                          )}
                          <span className="font-bold text-sm">{table.name}</span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {guests.length}/{table.capacity}
                        </span>
                      </div>

                      {/* Guest list */}
                      <div className="px-3 py-2 space-y-0.5">
                        {guests.map((g) => (
                          <div
                            key={`${g.guest_id}-${g.party_member_index}`}
                            className="flex items-center gap-1.5 text-xs"
                          >
                            <span
                              className={`flex-1 truncate ${
                                g.party_member_index !== null ? "pl-3 text-gray-600" : "font-medium"
                              }`}
                            >
                              {g.party_member_index !== null && (
                                <span className="text-gray-400 mr-1">└</span>
                              )}
                              {g.display_name}
                            </span>
                            {g.meal_preference && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 shrink-0">
                                {g.meal_preference}
                              </span>
                            )}
                          </div>
                        ))}
                        {emptySeats > 0 && (
                          <p className="text-[10px] text-gray-400 italic pt-0.5">
                            {emptySeats} empty seat{emptySeats !== 1 ? "s" : ""}
                          </p>
                        )}
                        {guests.length === 0 && (
                          <p className="text-[10px] text-gray-400 italic">No guests assigned</p>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Floor plan elements */}
            {fixtures.length > 0 && (
              <div className="mt-6 pt-4 border-t border-gray-200">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Floor Plan Elements
                </h3>
                <div className="flex flex-wrap gap-3">
                  {fixtures.map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-gray-200 bg-gray-50"
                    >
                      <span>{FIXTURE_ICONS[f.shape] || ""}</span>
                      <span className="text-gray-600">{f.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="mt-8 pt-4 border-t border-gray-200 text-center">
              <p className="text-[10px] text-gray-400">
                Generated {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
