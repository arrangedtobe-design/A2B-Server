"use client";

import { useState, useRef } from "react";
import {
  formatTime, getEndTime, formatDuration, formatDateLong, formatHourLabel,
  timeToMinutes, layoutEvents, LayoutItem,
} from "@/app/timeline/timeline-data";
import { exportTimelinePdf } from "@/lib/export-pdf";

const PREVIEW_PX_PER_MIN = 1.5;

// Light-theme category colors (always light for print-friendliness)
const CATEGORY_COLORS: Record<string, string> = {
  Preparation: "#E8D5E0",
  Ceremony: "#D4A574",
  Photos: "#7BA7BC",
  Reception: "#9B8EC4",
  Travel: "#6BAF8D",
  Vendor: "#E8A87C",
  General: "#B8B8B8",
};

interface SharedTimelineProps {
  items: any[];
  vendors: { id: string; name: string; color: string }[];
  eventVendors: Record<string, string[]>;
  timeline: any;
  event: any;
  share: any;
}

export function SharedTimeline({
  items,
  vendors,
  eventVendors,
  timeline,
  event,
  share,
}: SharedTimelineProps) {
  const handlePrint = () => window.print();
  const [exporting, setExporting] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const handleExportPdf = async () => {
    if (!contentRef.current || exporting) return;
    setExporting(true);
    // Clone element off-screen so the visible UI doesn't flicker
    const el = contentRef.current;
    const clone = el.cloneNode(true) as HTMLElement;
    const captureWidth = Math.round(572 * (96 / 72)) + "px"; // ~763px
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
      const name = [event?.name, timeline?.name].filter(Boolean).join(" - ") || "Timeline";
      await exportTimelinePdf(clone, `${name}.pdf`, isVendorMode ? { fitOnePage: true } : undefined);
    } catch (e) {
      console.error("PDF export failed:", e);
    }
    document.body.removeChild(clone);
    setExporting(false);
  };

  const vendorName = (vid: string) =>
    vendors.find((v) => v.id === vid)?.name || "Unknown";
  const vendorColor = (vid: string) =>
    vendors.find((v) => v.id === vid)?.color || "#B8B8B8";

  const sorted = [...items].sort((a, b) =>
    a.start_time < b.start_time ? -1 : a.start_time > b.start_time ? 1 : 0
  );

  const isVendorMode = share.mode === "vendor";
  const vendorIds: string[] = share.vendor_ids || [];

  // For vendor mode, filter items to those assigned to the baked-in vendors
  const displayItems = isVendorMode
    ? sorted.filter((item) => {
        const vids = eventVendors[item.id] || [];
        return vids.some((vid) => vendorIds.includes(vid));
      })
    : sorted;

  // Determine timeline bounds — trim to actual event range
  const firstEventMin = displayItems.length > 0
    ? timeToMinutes(displayItems[0].start_time)
    : 0;
  const lastEventEndMin = displayItems.length > 0
    ? timeToMinutes(displayItems[displayItems.length - 1].start_time) +
      displayItems[displayItems.length - 1].duration_minutes
    : 0;
  const startHour = displayItems.length > 0
    ? Math.max(Math.floor(firstEventMin / 60), 0)
    : timeline?.start_hour ?? 6;
  const endHour = displayItems.length > 0
    ? Math.min(Math.ceil(lastEventEndMin / 60), 24)
    : timeline?.end_hour ?? 24;

  const dStartMin = startHour * 60;
  const dEndMin = displayItems.length > 0 ? lastEventEndMin : endHour * 60;
  const totalMinutes = dEndMin - dStartMin;

  // For vendor mode, scale down px/min so the timeline fits ~700px (one print page)
  const PRINT_TARGET_HEIGHT = 700;
  const pxPerMin = isVendorMode && totalMinutes * PREVIEW_PX_PER_MIN > PRINT_TARGET_HEIGHT
    ? Math.max(PRINT_TARGET_HEIGHT / totalMinutes, 0.5)
    : PREVIEW_PX_PER_MIN;

  const totalHeight = totalMinutes * pxPerMin;

  // Layout events with column support
  const positioned = layoutEvents(displayItems, dStartMin).map((item) => {
    const startMin = timeToMinutes(item.start_time);
    const top = (startMin - dStartMin) * pxPerMin;
    const height = Math.max(item.duration_minutes * pxPerMin, 18);
    return { ...item, _top: top, _height: height };
  });

  // Hour labels — only show hours that fall within the event range
  const lastHour = Math.floor(lastEventEndMin / 60);
  const hourLabels: { hour: number; label: string; top: number }[] = [];
  for (let h = startHour; h <= lastHour; h++) {
    if (h * 60 > dEndMin) break;
    hourLabels.push({
      hour: h,
      label: formatHourLabel(h),
      top: (h * 60 - dStartMin) * pxPerMin,
    });
  }

  // Free blocks for vendor mode
  const freeBlocks: { startMin: number; endMin: number }[] = [];
  if (isVendorMode) {
    for (let i = 0; i < displayItems.length - 1; i++) {
      const cur = displayItems[i];
      const curEnd = timeToMinutes(cur.start_time) + cur.duration_minutes;
      const nextStart = timeToMinutes(displayItems[i + 1].start_time);
      if (nextStart > curEnd) {
        freeBlocks.push({ startMin: curEnd, endMin: nextStart });
      }
    }
  }

  const eventDate = timeline?.date || event?.wedding_date || "";
  const eventName = event?.name || "";
  const venueName = event?.venue || "";

  const EVENT_AREA_LEFT = 56;

  return (
    <div data-print-target className="min-h-screen bg-gray-100 print:bg-white">
      {/* Print / Export buttons */}
      <div className="fixed top-4 right-4 z-50 print:hidden flex gap-2">
        <button
          onClick={handlePrint}
          className="px-4 py-2 rounded-lg font-medium text-white bg-rose-500 hover:bg-rose-600 shadow-lg text-sm"
        >
          Print
        </button>
        <button
          onClick={handleExportPdf}
          disabled={exporting}
          className={"px-4 py-2 rounded-lg font-medium text-white bg-rose-500 shadow-lg text-sm" + (exporting ? " opacity-60 cursor-wait" : " hover:bg-rose-600")}
        >
          {exporting ? "Exporting..." : "Export PDF"}
        </button>
      </div>

      <div data-print-content className="max-w-[1100px] mx-auto py-8 px-4 print:py-0 print:px-0 print:max-w-none">
        <div ref={contentRef} className="bg-white text-black rounded-lg shadow-xl print:shadow-none print:rounded-none">
          <div className="p-8 print:p-4">
            {/* Header */}
            <div className="text-center mb-6 print:mb-3 border-b-2 border-gray-200 pb-5 print:pb-2">
              {eventName && (
                <h1 className="text-3xl font-bold tracking-tight mb-1">{eventName}</h1>
              )}
              <h2
                className={
                  "font-semibold text-gray-700 " +
                  (eventName ? "text-xl" : "text-3xl font-bold tracking-tight mb-1")
                }
              >
                {timeline?.name || "Timeline"}
              </h2>
              <div className="flex items-center justify-center gap-3 mt-2 text-sm text-gray-500">
                {eventDate && <span>{formatDateLong(eventDate)}</span>}
                {eventDate && venueName && <span>&middot;</span>}
                {venueName && <span>{venueName}</span>}
              </div>
              {isVendorMode && vendors.length > 0 && (
                <p className="text-sm text-gray-500 mt-2">
                  Timeline for: {vendors.map((v) => v.name).join(", ")}
                </p>
              )}
              {share.label && (
                <p className="text-sm text-gray-400 mt-1 italic">{share.label}</p>
              )}
            </div>

            {/* Timeline */}
            {displayItems.length === 0 ? (
              <div className="text-center py-16 text-gray-400">No events to display.</div>
            ) : (
              <div className="relative" style={{ height: totalHeight + "px" }}>
                {/* Hour lines */}
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

                {/* Free blocks (vendor mode) */}
                {freeBlocks.map((block, i) => {
                  const top = (block.startMin - dStartMin) * pxPerMin;
                  const height = (block.endMin - block.startMin) * pxPerMin;
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
                {positioned.map((item: LayoutItem) => {
                  const bgColor = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.General;
                  const endTime = getEndTime(item.start_time, item.duration_minutes);
                  const isCompact = item._height < 40;
                  const isTiny = item._height < 24;
                  const vids = isVendorMode
                    ? (eventVendors[item.id] || []).filter((vid) => vendorIds.includes(vid))
                    : eventVendors[item.id] || [];
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
                              <span className="text-[10px] font-bold text-gray-600 shrink-0">{formatTime(item.start_time)} → {formatTime(endTime)}</span>
                              <span className="font-semibold text-gray-900 text-[10px] truncate">{item.title}</span>
                            </div>
                          ) : isCompact ? (
                            <div className="flex items-center gap-1 overflow-hidden">
                              <span className="text-[11px] font-bold text-gray-600 shrink-0">{formatTime(item.start_time)} → {formatTime(endTime)}</span>
                              <span className="font-semibold text-gray-900 text-[12px] truncate">{item.title}</span>
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
                              <p className="font-semibold text-gray-900 text-[13px] leading-tight truncate">{item.title}</p>
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
            )}

            {/* Footer */}
            <div className="mt-8 print:mt-3 pt-4 print:pt-2 border-t border-gray-200 text-center">
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
