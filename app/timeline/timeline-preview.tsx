"use client";

import { useState, useEffect } from "react";
import {
  formatTime, getEndTime, formatDuration, formatDateLong, formatHourLabel,
  timeToMinutes, layoutEvents, LayoutItem,
} from "./timeline-data";

const PREVIEW_PX_PER_MIN = 1.5; // slightly more compact than the editor's 2px

interface TimelinePreviewProps {
  items: any[];
  vendors: any[];
  eventVendors: Record<string, string[]>;
  activeTl: any;
  event: any;
  CATEGORY_COLORS: Record<string, string>;
  onClose: () => void;
}

export function TimelinePreview({
  items,
  vendors,
  eventVendors,
  activeTl,
  event,
  CATEGORY_COLORS,
  onClose,
}: TimelinePreviewProps) {
  const [mode, setMode] = useState<"all" | "vendor">("all");
  const [selectedVendorIds, setSelectedVendorIds] = useState<string[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handlePrint = () => window.print();

  const toggleVendor = (vid: string) =>
    setSelectedVendorIds((prev) =>
      prev.includes(vid) ? prev.filter((v) => v !== vid) : [...prev, vid]
    );

  const vendorName = (vid: string) =>
    vendors.find((v) => v.id === vid)?.name || "Unknown";
  const vendorColor = (vid: string) =>
    vendors.find((v) => v.id === vid)?.color || "#B8B8B8";

  // Sort items by start time
  const sorted = [...items].sort((a, b) =>
    a.start_time < b.start_time ? -1 : a.start_time > b.start_time ? 1 : 0
  );

  // Vendor filtering (only applies in vendor mode)
  const vendorFiltered =
    selectedVendorIds.length === 0
      ? []
      : sorted.filter((item) => {
          const vids = eventVendors[item.id] || [];
          return vids.some((vid) => selectedVendorIds.includes(vid));
        });

  // Visual timeline layout for "all" mode
  const dStartMin = (activeTl?.start_hour ?? 6) * 60;
  const dEndMin = (activeTl?.end_hour ?? 24) * 60;
  const totalHeight = (dEndMin - dStartMin) * PREVIEW_PX_PER_MIN;
  const positioned = layoutEvents(sorted, dStartMin);
  // Re-compute positions with preview scale (layoutEvents uses PIXELS_PER_MINUTE=2, we need 1.5)
  const previewPositioned = positioned.map((item) => {
    const startMin = timeToMinutes(item.start_time);
    const top = (startMin - dStartMin) * PREVIEW_PX_PER_MIN;
    const height = Math.max(item.duration_minutes * PREVIEW_PX_PER_MIN, 18);
    return { ...item, _top: top, _height: height };
  });

  const hourLabels: { hour: number; label: string; top: number }[] = [];
  for (let h = activeTl?.start_hour ?? 6; h <= (activeTl?.end_hour ?? 24); h++) {
    hourLabels.push({
      hour: h,
      label: formatHourLabel(h),
      top: (h * 60 - dStartMin) * PREVIEW_PX_PER_MIN,
    });
  }

  const hasVendors = vendors.length > 0;
  const eventDate = activeTl?.date || event?.wedding_date || "";
  const eventName = event?.name || "";
  const venueName = event?.venue || "";

  const EVENT_AREA_LEFT = 56; // px for hour labels

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/60">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 bg-surface border-b border-app-border shrink-0 print:hidden">
        <h2 className="text-lg font-bold text-heading">Timeline Preview</h2>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-app-border overflow-hidden">
            <button
              onClick={() => setMode("all")}
              className={
                "text-sm px-3 py-1.5 font-medium transition-colors " +
                (mode === "all"
                  ? "bg-rose-app text-white"
                  : "bg-surface text-body hover:bg-page-bg")
              }
            >
              All Events
            </button>
            <button
              onClick={() => { if (hasVendors) setMode("vendor"); }}
              className={
                "text-sm px-3 py-1.5 font-medium transition-colors border-l border-app-border " +
                (mode === "vendor"
                  ? "bg-rose-app text-white"
                  : hasVendors
                    ? "bg-surface text-body hover:bg-page-bg"
                    : "bg-surface text-body opacity-40 cursor-not-allowed")
              }
            >
              Vendor Timeline
            </button>
          </div>
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

      {/* Vendor filter row */}
      {mode === "vendor" && (
        <div className="px-6 py-3 bg-surface border-b border-app-border shrink-0 print:hidden">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium text-subtle">Select Vendors</span>
            {vendors.map((v) => (
              <button
                key={v.id}
                onClick={() => toggleVendor(v.id)}
                className={
                  "text-xs px-3 py-1.5 rounded-full border transition-colors " +
                  (selectedVendorIds.includes(v.id)
                    ? "border-transparent text-white"
                    : "text-body border-app-border hover:bg-page-bg")
                }
                style={
                  selectedVendorIds.includes(v.id)
                    ? { backgroundColor: v.color || "#9B8EC4" }
                    : {}
                }
              >
                {v.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Scrollable preview area */}
      <div className="flex-1 overflow-auto p-6 print:p-0 print:overflow-visible">
        <div className="max-w-[1100px] mx-auto bg-white text-black rounded-lg shadow-xl print:shadow-none print:rounded-none print:max-w-none">
          <div className="p-8 print:p-10">
            {/* Header */}
            <div className="text-center mb-6 border-b-2 border-gray-200 pb-5">
              {eventName && (
                <h1 className="text-3xl font-bold tracking-tight mb-1">{eventName}</h1>
              )}
              <h2 className={"font-semibold text-gray-700 " + (eventName ? "text-xl" : "text-3xl font-bold tracking-tight mb-1")}>
                {activeTl?.name || "Timeline"}
              </h2>
              <div className="flex items-center justify-center gap-3 mt-2 text-sm text-gray-500">
                {eventDate && <span>{formatDateLong(eventDate)}</span>}
                {eventDate && venueName && <span>&middot;</span>}
                {venueName && <span>{venueName}</span>}
              </div>
              {mode === "vendor" && selectedVendorIds.length > 0 && (
                <p className="text-sm text-gray-500 mt-2">
                  Showing events for: {selectedVendorIds.map((vid) => vendorName(vid)).join(", ")}
                </p>
              )}
            </div>

            {/* ——— ALL EVENTS: Visual timeline layout ——— */}
            {mode === "all" && (
              sorted.length === 0 ? (
                <div className="text-center py-16 text-gray-400">No events to display.</div>
              ) : (
                <div className="relative" style={{ height: totalHeight + "px" }}>
                  {/* Hour lines — full-width but behind opaque cards */}
                  {hourLabels.map(({ hour, label, top }) => (
                    <div key={hour} className="absolute left-0 right-0" style={{ top: top + "px", zIndex: 1 }}>
                      <div className="flex items-start">
                        <span className="text-[11px] font-semibold text-gray-500 w-[52px] text-right pr-2 -mt-2 shrink-0">
                          {label}
                        </span>
                        <div className="flex-1 border-t border-gray-200"></div>
                      </div>
                    </div>
                  ))}

                  {/* Event cards */}
                  {previewPositioned.map((item: LayoutItem) => {
                    const bgColor = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.General;
                    const endTime = getEndTime(item.start_time, item.duration_minutes);
                    const isCompact = item._height < 40;
                    const isTiny = item._height < 24;
                    const vids = eventVendors[item.id] || [];
                    const colSpan = (item as any)._colSpan || 1;
                    const gap = item._totalCols > 1 ? 2 : 0;

                    return (
                      <div
                        key={item.id}
                        className="absolute break-inside-avoid"
                        style={{
                          left: item._totalCols === 1
                            ? `${EVENT_AREA_LEFT}px`
                            : `calc(${EVENT_AREA_LEFT}px + (100% - ${EVENT_AREA_LEFT}px) * ${item._col / item._totalCols})`,
                          width: item._totalCols === 1
                            ? `calc(100% - ${EVENT_AREA_LEFT}px)`
                            : `calc((100% - ${EVENT_AREA_LEFT}px) * ${colSpan / item._totalCols} - ${gap}px)`,
                          top: item._top + "px",
                          height: item._height + "px",
                          zIndex: 10,
                        }}
                      >
                        <div
                          className="h-full rounded-md border border-gray-300 overflow-hidden flex shadow-sm"
                          style={{ borderLeftWidth: "4px", borderLeftColor: bgColor, background: `linear-gradient(${bgColor}15, ${bgColor}15), #ffffff` }}
                        >
                          <div className="flex-1 px-2 py-1 overflow-hidden flex flex-col justify-center min-w-0">
                            {isTiny ? (
                              <div className="flex items-center gap-1 overflow-hidden">
                                <span className="text-[10px] font-bold text-gray-600 shrink-0">{formatTime(item.start_time)}</span>
                                <span className="font-semibold text-gray-900 text-[10px] truncate">{item.title}</span>
                              </div>
                            ) : isCompact ? (
                              <div className="flex items-center gap-1 overflow-hidden">
                                <span className="text-[11px] font-bold text-gray-600 shrink-0">{formatTime(item.start_time)}</span>
                                <span className="font-semibold text-gray-900 text-xs truncate">{item.title}</span>
                                {vids.slice(0, 2).map((vid) => (
                                  <span key={vid} className="text-[10px] px-1 rounded shrink-0 font-medium" style={{ backgroundColor: vendorColor(vid) + "50" }}>
                                    {vendorName(vid)}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] font-bold text-gray-600">
                                    {formatTime(item.start_time)} → {formatTime(endTime)}
                                  </span>
                                  <span className="text-[11px] text-gray-500">{formatDuration(item.duration_minutes)}</span>
                                </div>
                                <p className="font-semibold text-gray-900 text-sm leading-tight truncate">{item.title}</p>
                                {item._height > 56 && (
                                  <div className="flex flex-wrap gap-1 mt-0.5">
                                    {item.location && (
                                      <span className="text-[11px] text-gray-600">&#8226; {item.location}</span>
                                    )}
                                    {vids.map((vid) => (
                                      <span key={vid} className="text-[10px] px-1.5 rounded-full font-medium" style={{ backgroundColor: vendorColor(vid) + "50" }}>
                                        {vendorName(vid)}
                                      </span>
                                    ))}
                                    <span
                                      className="text-[10px] px-1.5 rounded-full font-medium"
                                      style={{ backgroundColor: bgColor + "40", color: bgColor }}
                                    >
                                      {item.category}
                                    </span>
                                  </div>
                                )}
                                {item._height > 80 && item.notes && (
                                  <p className="text-[10px] text-gray-500 mt-0.5 truncate italic">{item.notes}</p>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}

            {/* ——— VENDOR TIMELINE: Visual timeline with free blocks ——— */}
            {mode === "vendor" && (
              vendorFiltered.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  {selectedVendorIds.length === 0
                    ? "Select one or more vendors above to see their events."
                    : "No events to display."}
                </div>
              ) : (() => {
                // Scope the timeline from the hour of the first event to the hour after the last event ends
                const firstMin = timeToMinutes(vendorFiltered[0].start_time);
                const lastItem = vendorFiltered[vendorFiltered.length - 1];
                const lastEndMin = timeToMinutes(lastItem.start_time) + lastItem.duration_minutes;
                const vStartHour = Math.floor(firstMin / 60);
                const vEndHour = Math.min(Math.ceil(lastEndMin / 60), 24);
                const vStartMin = vStartHour * 60;
                const vTotalHeight = (vEndHour * 60 - vStartMin) * PREVIEW_PX_PER_MIN;

                // Hour labels for vendor range
                const vHourLabels: { hour: number; label: string; top: number }[] = [];
                for (let h = vStartHour; h <= vEndHour; h++) {
                  vHourLabels.push({ hour: h, label: formatHourLabel(h), top: (h * 60 - vStartMin) * PREVIEW_PX_PER_MIN });
                }

                // Build free blocks between vendor events
                const freeBlocks: { startMin: number; endMin: number }[] = [];
                for (let i = 0; i < vendorFiltered.length - 1; i++) {
                  const cur = vendorFiltered[i];
                  const curEnd = timeToMinutes(cur.start_time) + cur.duration_minutes;
                  const nextStart = timeToMinutes(vendorFiltered[i + 1].start_time);
                  if (nextStart > curEnd) {
                    freeBlocks.push({ startMin: curEnd, endMin: nextStart });
                  }
                }

                // Layout vendor events with column support
                const vPositioned = layoutEvents(vendorFiltered, vStartMin).map((item) => {
                  const startMin = timeToMinutes(item.start_time);
                  const top = (startMin - vStartMin) * PREVIEW_PX_PER_MIN;
                  const height = Math.max(item.duration_minutes * PREVIEW_PX_PER_MIN, 18);
                  return { ...item, _top: top, _height: height };
                });

                return (
                  <div className="relative" style={{ height: vTotalHeight + "px" }}>
                    {/* Hour lines — full-width but behind opaque cards */}
                    {vHourLabels.map(({ hour, label, top }) => (
                      <div key={hour} className="absolute left-0 right-0" style={{ top: top + "px", zIndex: 1 }}>
                        <div className="flex items-start">
                          <span className="text-[11px] font-semibold text-gray-500 w-[52px] text-right pr-2 -mt-2 shrink-0">
                            {label}
                          </span>
                          <div className="flex-1 border-t border-gray-200"></div>
                        </div>
                      </div>
                    ))}

                    {/* Free / break blocks */}
                    {freeBlocks.map((block, i) => {
                      const top = (block.startMin - vStartMin) * PREVIEW_PX_PER_MIN;
                      const height = (block.endMin - block.startMin) * PREVIEW_PX_PER_MIN;
                      const gapMin = block.endMin - block.startMin;
                      return (
                        <div
                          key={`free-${i}`}
                          className="absolute rounded-md border border-dashed border-gray-300 overflow-hidden"
                          style={{
                            left: `${EVENT_AREA_LEFT}px`,
                            width: `calc(100% - ${EVENT_AREA_LEFT}px)`,
                            top: top + "px",
                            height: height + "px",
                            zIndex: 5,
                            background: "repeating-linear-gradient(135deg, transparent, transparent 4px, #f3f4f6 4px, #f3f4f6 5px)",
                          }}
                        >
                          <div className="h-full flex items-center justify-center">
                            <span className="text-[11px] text-gray-400 font-medium bg-white/80 px-2 py-0.5 rounded">
                              {formatDuration(gapMin)} free
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {/* Event cards */}
                    {vPositioned.map((item: LayoutItem) => {
                      const bgColor = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.General;
                      const endTime = getEndTime(item.start_time, item.duration_minutes);
                      const isCompact = item._height < 40;
                      const isTiny = item._height < 24;
                      const vids = (eventVendors[item.id] || []).filter((vid) =>
                        selectedVendorIds.includes(vid)
                      );
                      const colSpan = (item as any)._colSpan || 1;
                      const gap = item._totalCols > 1 ? 2 : 0;

                      return (
                        <div
                          key={item.id}
                          className="absolute break-inside-avoid"
                          style={{
                            left: item._totalCols === 1
                              ? `${EVENT_AREA_LEFT}px`
                              : `calc(${EVENT_AREA_LEFT}px + (100% - ${EVENT_AREA_LEFT}px) * ${item._col / item._totalCols})`,
                            width: item._totalCols === 1
                              ? `calc(100% - ${EVENT_AREA_LEFT}px)`
                              : `calc((100% - ${EVENT_AREA_LEFT}px) * ${colSpan / item._totalCols} - ${gap}px)`,
                            top: item._top + "px",
                            height: item._height + "px",
                            zIndex: 10,
                          }}
                        >
                          <div
                            className="h-full rounded-md border border-gray-300 overflow-hidden flex shadow-sm"
                            style={{ borderLeftWidth: "4px", borderLeftColor: bgColor, background: `linear-gradient(${bgColor}15, ${bgColor}15), #ffffff` }}
                          >
                            <div className="flex-1 px-2 py-1 overflow-hidden flex flex-col justify-center min-w-0">
                              {isTiny ? (
                                <div className="flex items-center gap-1 overflow-hidden">
                                  <span className="text-[10px] font-bold text-gray-600 shrink-0">{formatTime(item.start_time)}</span>
                                  <span className="font-semibold text-gray-900 text-[10px] truncate">{item.title}</span>
                                </div>
                              ) : isCompact ? (
                                <div className="flex items-center gap-1 overflow-hidden">
                                  <span className="text-[11px] font-bold text-gray-600 shrink-0">{formatTime(item.start_time)}</span>
                                  <span className="font-semibold text-gray-900 text-xs truncate">{item.title}</span>
                                  {vids.slice(0, 2).map((vid) => (
                                    <span key={vid} className="text-[10px] px-1 rounded shrink-0 font-medium" style={{ backgroundColor: vendorColor(vid) + "50" }}>
                                      {vendorName(vid)}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[11px] font-bold text-gray-600">
                                      {formatTime(item.start_time)} → {formatTime(endTime)}
                                    </span>
                                    <span className="text-[11px] text-gray-500">{formatDuration(item.duration_minutes)}</span>
                                  </div>
                                  <p className="font-semibold text-gray-900 text-sm leading-tight truncate">{item.title}</p>
                                  {item._height > 56 && (
                                    <div className="flex flex-wrap gap-1 mt-0.5">
                                      {item.location && (
                                        <span className="text-[11px] text-gray-600">&#8226; {item.location}</span>
                                      )}
                                      {vids.map((vid) => (
                                        <span key={vid} className="text-[10px] px-1.5 rounded-full font-medium" style={{ backgroundColor: vendorColor(vid) + "50" }}>
                                          {vendorName(vid)}
                                        </span>
                                      ))}
                                      <span
                                        className="text-[10px] px-1.5 rounded-full font-medium"
                                        style={{ backgroundColor: bgColor + "40", color: bgColor }}
                                      >
                                        {item.category}
                                      </span>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()
            )}

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
