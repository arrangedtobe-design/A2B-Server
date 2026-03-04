"use client";

import { useState, useEffect, useRef } from "react";
import { exportTimelinePdf } from "@/lib/export-pdf";

interface GuestListPreviewProps {
  guests: any[];
  rsvpResponses: Record<string, any>;
  rsvpTokens: Record<string, any>;
  event: { name: string } | null;
  mealOptions: string[];
  onClose: () => void;
}

interface PreviewRow {
  name: string;
  role: string;
  meal: string;
  allergens: string;
  highchair: boolean;
  isPrimary: boolean;
  guestOfName?: string;
  groupedUnderPrimary?: boolean;
}

export function GuestListPreview({
  guests,
  rsvpResponses,
  rsvpTokens,
  event,
  mealOptions,
  onClose,
}: GuestListPreviewProps) {
  const [exporting, setExporting] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // --- Build grouped lists ---
  const attending: PreviewRow[] = [];
  const pending: PreviewRow[] = [];
  const declined: PreviewRow[] = [];

  for (const guest of guests) {
    const response = rsvpResponses[guest.id];
    const partyMembers = guest.party_members || [];
    const partyResponses: any[] = response?.party_responses || [];
    const primaryMeal = response?.meal_preference || guest.meal_preference || "";
    const primaryAllergens = response?.dietary_notes || guest.dietary_notes || "";

    const primaryRow: PreviewRow = {
      name: guest.name,
      role: "Primary",
      meal: primaryMeal,
      allergens: primaryAllergens,
      highchair: false,
      isPrimary: true,
    };

    if (guest.rsvp_status === "confirmed") {
      attending.push(primaryRow);

      // Add attending party members
      partyMembers.forEach((member: any, i: number) => {
        const pr = partyResponses[i];
        const status = pr?.attending || "coming";
        const row: PreviewRow = {
          name: pr?.name || member.name,
          role: member.label || "Guest",
          meal: pr?.meal_preference || "",
          allergens: pr?.dietary_notes || "",
          highchair: !!(pr?.needs_highchair ?? member.needs_highchair),
          isPrimary: false,
          guestOfName: guest.name,
        };

        if (status === "coming") {
          attending.push({ ...row, groupedUnderPrimary: true });
        } else if (status === "unsure") {
          pending.push({ ...row, guestOfName: guest.name });
        } else if (status === "not_coming") {
          declined.push({ ...row, guestOfName: guest.name });
        }
      });
    } else if (guest.rsvp_status === "declined") {
      declined.push(primaryRow);

      // Declined primary — party members also declined, grouped under primary
      partyMembers.forEach((member: any, i: number) => {
        const pr = partyResponses[i];
        declined.push({
          name: pr?.name || member.name,
          role: member.label || "Guest",
          meal: "",
          allergens: "",
          highchair: false,
          isPrimary: false,
          guestOfName: guest.name,
          groupedUnderPrimary: true,
        });
      });
    } else {
      // pending
      pending.push(primaryRow);

      partyMembers.forEach((member: any, i: number) => {
        const pr = partyResponses[i];
        pending.push({
          name: pr?.name || member.name,
          role: member.label || "Guest",
          meal: pr?.meal_preference || "",
          allergens: pr?.dietary_notes || "",
          highchair: !!(pr?.needs_highchair ?? member.needs_highchair),
          isPrimary: false,
          guestOfName: guest.name,
          groupedUnderPrimary: true,
        });
      });
    }
  }

  const totalPeople = attending.length + pending.length + declined.length;
  const allRows = [...attending, ...pending, ...declined];
  const highchairCount = attending.filter((r) => r.highchair).length;
  const allergyCount = attending.filter((r) => r.allergens).length;

  // Break down meals by option
  const mealBreakdown: Record<string, number> = {};
  let noMealCount = 0;
  let childrenMealCount = 0;
  for (const r of attending) {
    if (r.highchair || r.role === "Child") {
      childrenMealCount++;
    } else if (r.meal) {
      mealBreakdown[r.meal] = (mealBreakdown[r.meal] || 0) + 1;
    } else {
      noMealCount++;
    }
  }
  const mealEntries = Object.entries(mealBreakdown).sort((a, b) => b[1] - a[1]);

  const handlePrint = () => window.print();

  const handleExportPdf = async () => {
    if (!contentRef.current || exporting) return;
    setExporting(true);
    const el = contentRef.current;
    const clone = el.cloneNode(true) as HTMLElement;
    const captureWidth = Math.round(572 * (96 / 72)) + "px";
    clone.style.position = "fixed";
    clone.style.left = "-9999px";
    clone.style.top = "0";
    clone.style.width = captureWidth;
    clone.style.maxWidth = captureWidth;
    clone.style.overflow = "visible";
    clone.style.boxShadow = "none";
    clone.style.zIndex = "-1";
    document.body.appendChild(clone);
    clone.offsetHeight; // force reflow
    try {
      const name = event?.name ? `${event.name} - Guest List` : "Guest List";
      await exportTimelinePdf(clone, `${name}.pdf`);
    } catch (e) {
      console.error("PDF export failed:", e);
    }
    document.body.removeChild(clone);
    setExporting(false);
  };

  const renderTable = (rows: PreviewRow[], showFullDetail: boolean) => {
    if (rows.length === 0) {
      return (
        <p className="text-sm text-gray-400 italic py-3 px-2">None</p>
      );
    }

    return (
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b-2 border-gray-200">
            <th className="text-left py-2 px-2 font-semibold text-gray-700">Name</th>
            <th className="text-left py-2 px-2 font-semibold text-gray-700">Role</th>
            {showFullDetail && (
              <>
                <th className="text-left py-2 px-2 font-semibold text-gray-700">Meal</th>
                <th className="text-left py-2 px-2 font-semibold text-gray-700">Allergens / Dietary</th>
                <th className="text-center py-2 px-2 font-semibold text-gray-700">High Chair</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className="border-b border-gray-100"
            >
              <td className={"py-1.5 px-2 text-gray-900" + (row.groupedUnderPrimary && !row.isPrimary ? " pl-3" : "")}>
                {row.groupedUnderPrimary && !row.isPrimary ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="text-gray-300">└</span>
                    {row.name}
                  </span>
                ) : (
                  <>
                    {row.name}
                    {!row.groupedUnderPrimary && row.guestOfName && !row.isPrimary && (
                      <span className="text-gray-400 ml-1">(guest of {row.guestOfName})</span>
                    )}
                  </>
                )}
              </td>
              <td className="py-1.5 px-2 text-gray-600">{row.role}</td>
              {showFullDetail && (
                <>
                  <td className="py-1.5 px-2 text-gray-600">{row.highchair || row.role === "Child" ? "Children's meal" : (row.meal || "\u2014")}</td>
                  <td className="py-1.5 px-2 text-gray-600">{row.allergens || "\u2014"}</td>
                  <td className="py-1.5 px-2 text-center">{row.highchair ? "\u2713" : ""}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <div data-print-target className="fixed inset-0 z-50 flex flex-col bg-black/60">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 bg-surface border-b border-app-border shrink-0 print:hidden">
        <h2 className="text-lg font-bold text-heading">Guest List Preview</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrint}
            className="text-sm px-4 py-1.5 rounded-lg font-medium text-white bg-rose-app"
          >
            Print
          </button>
          <button
            onClick={handleExportPdf}
            disabled={exporting}
            className={
              "text-sm px-4 py-1.5 rounded-lg font-medium text-white bg-rose-app" +
              (exporting ? " opacity-60 cursor-wait" : "")
            }
          >
            {exporting ? "Exporting..." : "Export PDF"}
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
          ref={contentRef}
          data-print-content
          className="max-w-[900px] mx-auto bg-white text-black rounded-lg shadow-xl print:shadow-none print:rounded-none print:max-w-none"
        >
          <div className="p-8 print:p-6">
            {/* Header */}
            <div className="text-center mb-6 print:mb-4 border-b-2 border-gray-200 pb-5 print:pb-3">
              {event?.name && (
                <h1 className="text-3xl font-bold tracking-tight mb-1">{event.name}</h1>
              )}
              <h2 className={"font-semibold text-gray-700 " + (event?.name ? "text-xl" : "text-3xl font-bold tracking-tight mb-1")}>
                Guest List
              </h2>
              <p className="text-sm text-gray-500 mt-2">
                Generated{" "}
                {new Date().toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-4 gap-3 mb-3">
              {[
                { label: "Total", value: totalPeople },
                { label: "Attending", value: attending.length },
                { label: "Pending", value: pending.length },
                { label: "Declined", value: declined.length },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="text-center py-3 px-2 rounded-lg border border-gray-200 bg-gray-50"
                >
                  <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{stat.label}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-3 mb-8">
              {/* Meal breakdown */}
              <div className="w-1/2 py-3 px-4 rounded-lg border border-gray-200 bg-gray-50">
                <div className="text-xs font-semibold text-gray-700 mb-2">Meals</div>
                {mealEntries.length > 0 || childrenMealCount > 0 ? (
                  <div className="space-y-1">
                    {mealEntries.map(([meal, count]) => (
                      <div key={meal} className="flex items-center text-sm">
                        <span className="text-gray-700 flex-1">{meal}</span>
                        <span className="font-bold text-gray-900 w-8 text-center">{count}</span>
                      </div>
                    ))}
                    {childrenMealCount > 0 && (
                      <div className="flex items-center text-sm">
                        <span className="text-gray-700 flex-1">Children&apos;s meals</span>
                        <span className="font-bold text-gray-900 w-8 text-center">{childrenMealCount}</span>
                      </div>
                    )}
                    {noMealCount > 0 && (
                      <div className="flex items-center text-sm">
                        <span className="text-gray-700 flex-1">No selection</span>
                        <span className="font-bold text-gray-900 w-8 text-center">{noMealCount}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic">None selected</p>
                )}
              </div>
              {/* Allergies & High Chairs */}
              <div className="w-1/2 flex flex-col gap-3">
                <div className="text-center py-3 px-5 rounded-lg border border-gray-200 bg-gray-50 flex-1 flex flex-col justify-center">
                  <div className="text-2xl font-bold text-gray-900">{allergyCount}</div>
                  <div className="text-xs text-gray-500 mt-0.5">Allergies / Dietary</div>
                </div>
                <div className="text-center py-3 px-5 rounded-lg border border-gray-200 bg-gray-50 flex-1 flex flex-col justify-center">
                  <div className="text-2xl font-bold text-gray-900">{highchairCount}</div>
                  <div className="text-xs text-gray-500 mt-0.5">High Chairs</div>
                </div>
              </div>
            </div>

            {/* Attending Section */}
            <div className="mb-8">
              <h3 className="text-lg font-bold text-gray-900 mb-3 pb-1 border-b border-gray-300">
                Attending ({attending.length})
              </h3>
              {renderTable(attending, true)}
            </div>

            {/* Pending Section */}
            <div className="mb-8">
              <h3 className="text-lg font-bold text-gray-900 mb-3 pb-1 border-b border-gray-300">
                Pending ({pending.length})
              </h3>
              {renderTable(pending, false)}
            </div>

            {/* Declined Section */}
            <div className="mb-8">
              <h3 className="text-lg font-bold text-gray-900 mb-3 pb-1 border-b border-gray-300">
                Declined ({declined.length})
              </h3>
              {renderTable(declined, false)}
            </div>

            {/* Footer */}
            <div className="mt-8 pt-4 border-t border-gray-200 text-center">
              <p className="text-[10px] text-gray-400">
                Generated{" "}
                {new Date().toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
