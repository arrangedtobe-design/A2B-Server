"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { exportTimelinePdf } from "@/lib/export-pdf";
import {
  formatTime, getEndTime, formatDuration, formatDateLong, formatHourLabel,
  timeToMinutes, layoutEvents, LayoutItem,
} from "./timeline-data";

const PREVIEW_PX_PER_MIN = 1.5; // slightly more compact than the editor's 2px

interface ShareRecord {
  id: string;
  token: string;
  mode: "all" | "vendor";
  vendor_ids: string[];
  label: string | null;
  created_at: string;
}

interface TimelinePreviewProps {
  items: any[];
  vendors: any[];
  eventVendors: Record<string, string[]>;
  activeTl: any;
  event: any;
  eventId: string;
  CATEGORY_COLORS: Record<string, string>;
  onClose: () => void;
}

export function TimelinePreview({
  items,
  vendors,
  eventVendors,
  activeTl,
  event,
  eventId,
  CATEGORY_COLORS,
  onClose,
}: TimelinePreviewProps) {
  const [mode, setMode] = useState<"all" | "vendor">("all");
  const [selectedVendorIds, setSelectedVendorIds] = useState<string[]>([]);

  // Share state
  const [showSharePanel, setShowSharePanel] = useState(false);
  const [shares, setShares] = useState<ShareRecord[]>([]);
  const [shareMode, setShareMode] = useState<"all" | "vendor">("all");
  const [shareVendorIds, setShareVendorIds] = useState<string[]>([]);
  const [shareLabel, setShareLabel] = useState("");
  const [copying, setCopying] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const fetchShares = useCallback(async () => {
    if (!activeTl?.id) return;
    try {
      const res = await fetch(`/api/timeline/share?event_id=${eventId}&timeline_id=${activeTl.id}`);
      const data = await res.json();
      if (data.shares) setShares(data.shares);
    } catch {}
  }, [eventId, activeTl?.id]);

  useEffect(() => {
    fetchShares();
  }, [fetchShares]);

  const createShare = async () => {
    if (!activeTl?.id || creating) return;
    if (shareMode === "vendor" && shareVendorIds.length === 0) return;
    setCreating(true);
    try {
      const res = await fetch("/api/timeline/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          timeline_id: activeTl.id,
          mode: shareMode,
          vendor_ids: shareMode === "vendor" ? shareVendorIds : [],
          label: shareLabel.trim() || null,
        }),
      });
      if (res.ok) {
        setShareLabel("");
        setShareVendorIds([]);
        await fetchShares();
      }
    } catch {}
    setCreating(false);
  };

  const revokeShare = async (id: string) => {
    try {
      await fetch(`/api/timeline/share?id=${id}`, { method: "DELETE" });
      await fetchShares();
    } catch {}
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/timeline-share/${token}`;
    navigator.clipboard.writeText(url);
    setCopying(token);
    setTimeout(() => setCopying(null), 2000);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handlePrint = () => window.print();

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
      const name = [eventName, activeTl?.name].filter(Boolean).join(" - ") || "Timeline";
      await exportTimelinePdf(clone, `${name}.pdf`, displayMode === "vendor" ? { fitOnePage: true } : undefined);
    } catch (e) {
      console.error("PDF export failed:", e);
    }
    document.body.removeChild(clone);
    setExporting(false);
  };

  const toggleVendor = (vid: string) =>
    setSelectedVendorIds((prev) =>
      prev.includes(vid) ? prev.filter((v) => v !== vid) : [...prev, vid]
    );

  const vendorName = (vid: string) =>
    vendors.find((v) => v.id === vid)?.name || "Unknown";
  const vendorColor = (vid: string) =>
    vendors.find((v) => v.id === vid)?.color || "#B8B8B8";

  // When share panel is open, preview reflects the share settings
  const displayMode = showSharePanel ? shareMode : mode;
  const displayVendorIds = showSharePanel ? shareVendorIds : selectedVendorIds;

  // Sort items by start time
  const sorted = [...items].sort((a, b) =>
    a.start_time < b.start_time ? -1 : a.start_time > b.start_time ? 1 : 0
  );

  // Vendor filtering (only applies in vendor mode)
  const vendorFiltered =
    displayVendorIds.length === 0
      ? []
      : sorted.filter((item) => {
          const vids = eventVendors[item.id] || [];
          return vids.some((vid) => displayVendorIds.includes(vid));
        });

  // Visual timeline layout for "all" mode — trim to actual event range
  const allFirstMin = sorted.length > 0 ? timeToMinutes(sorted[0].start_time) : 0;
  const allLastItem = sorted.length > 0 ? sorted[sorted.length - 1] : null;
  const allLastEndMin = allLastItem
    ? timeToMinutes(allLastItem.start_time) + allLastItem.duration_minutes
    : 0;
  const dStartMin = sorted.length > 0
    ? Math.max(Math.floor(allFirstMin / 60), 0) * 60
    : (activeTl?.start_hour ?? 6) * 60;
  const dEndMin = sorted.length > 0
    ? allLastEndMin
    : (activeTl?.end_hour ?? 24) * 60;
  const totalHeight = (dEndMin - dStartMin) * PREVIEW_PX_PER_MIN;
  const positioned = layoutEvents(sorted, dStartMin);
  const previewPositioned = positioned.map((item) => {
    const startMin = timeToMinutes(item.start_time);
    const top = (startMin - dStartMin) * PREVIEW_PX_PER_MIN;
    const height = Math.max(item.duration_minutes * PREVIEW_PX_PER_MIN, 18);
    return { ...item, _top: top, _height: height };
  });

  const allLastHour = Math.floor(allLastEndMin / 60);
  const hourLabels: { hour: number; label: string; top: number }[] = [];
  for (let h = Math.floor(dStartMin / 60); h <= allLastHour; h++) {
    if (h * 60 > dEndMin) break;
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

  // Compute print-adjusted positions to avoid page-break card splits
  const PRINT_FIRST_PAGE = 700; // px of timeline content on first page (after header)
  const PRINT_PAGE = 880;       // px of timeline content on subsequent pages
  const MAX_UNSPLIT_HEIGHT = 180 * PREVIEW_PX_PER_MIN; // 3 hours — cards taller than this can split

  function computePrintGaps(items: LayoutItem[]): Map<number, number> {
    // Returns a map of original _top position → cumulative gap to add
    const sorted = [...items].sort((a, b) => a._top - b._top);
    let cumulativeGap = 0;
    const gaps = new Map<number, number>(); // store gap for each item's _top

    for (const item of sorted) {
      const adjTop = item._top + cumulativeGap;
      const adjBottom = adjTop + item._height;

      // Find the next page boundary this card might cross
      let pageBreak: number;
      if (adjTop < PRINT_FIRST_PAGE) {
        pageBreak = PRINT_FIRST_PAGE;
      } else {
        const pagesSinceFirst = Math.floor((adjTop - PRINT_FIRST_PAGE) / PRINT_PAGE);
        pageBreak = PRINT_FIRST_PAGE + (pagesSinceFirst + 1) * PRINT_PAGE;
      }

      // If card crosses the break and is small enough to move
      if (adjTop < pageBreak && adjBottom > pageBreak && item._height < MAX_UNSPLIT_HEIGHT) {
        const push = pageBreak - adjTop + 4;
        cumulativeGap += push;
      }

      gaps.set(item._top, cumulativeGap);
    }

    return gaps;
  }

  function adjustForPrint(
    items: LayoutItem[],
    hours: { hour: number; label: string; top: number }[],
    totalH: number
  ) {
    const gaps = computePrintGaps(items);
    let maxGap = 0;
    gaps.forEach((g) => { if (g > maxGap) maxGap = g; });

    const adjItems = items.map((item) => ({
      ...item,
      _top: item._top + (gaps.get(item._top) ?? 0),
    }));

    const adjHours = hours.map((h) => {
      // Find the gap that applies at this hour's top position
      let gap = 0;
      gaps.forEach((g, top) => { if (top <= h.top && g > gap) gap = g; });
      return { ...h, top: h.top + gap };
    });

    return { items: adjItems, hours: adjHours, totalHeight: totalH + maxGap };
  }

  const renderEventCard = (item: LayoutItem, areaLeft: number, vendorIdFilter?: string[]) => {
    const bgColor = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.General;
    const endTime = getEndTime(item.start_time, item.duration_minutes);
    const top = item._top;
    const height = item._height;
    const isCompact = height < 40;
    const isTiny = height < 24;
    const vids = vendorIdFilter
      ? (eventVendors[item.id] || []).filter((vid) => vendorIdFilter.includes(vid))
      : eventVendors[item.id] || [];
    const colSpan = (item as any)._colSpan || 1;
    const gap = item._totalCols > 1 ? 2 : 0;

    return (
      <div
        key={item.id}
        className="absolute"
        style={{
          left: item._totalCols === 1
            ? `${areaLeft}px`
            : `calc(${areaLeft}px + (100% - ${areaLeft}px) * ${item._col / item._totalCols})`,
          width: item._totalCols === 1
            ? `calc(100% - ${areaLeft}px)`
            : `calc((100% - ${areaLeft}px) * ${colSpan / item._totalCols} - ${gap}px)`,
          top: top + "px",
          height: height + "px",
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
                {height > 56 && (
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
                {height > 80 && item.notes && (
                  <p className="text-[10px] text-gray-500 mt-0.5 truncate italic">{item.notes}</p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div data-print-target className="fixed inset-0 z-50 flex flex-col bg-black/60">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 bg-surface border-b border-app-border shrink-0 print:hidden">
        <h2 className="text-lg font-bold text-heading">Timeline Preview</h2>
        <div className="flex items-center gap-3">
          {!showSharePanel && (
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
          )}
          {!showSharePanel && (
            <button
              onClick={() => {
                setShareMode(mode);
                setShareVendorIds([...selectedVendorIds]);
                setShowSharePanel(true);
              }}
              className="text-sm px-4 py-1.5 rounded-lg font-medium text-white bg-rose-app"
            >
              Share
            </button>
          )}
          {!showSharePanel && (
            <>
              <button
                onClick={handlePrint}
                className="text-sm px-4 py-1.5 rounded-lg font-medium text-white bg-rose-app"
              >
                Print
              </button>
              <button
                onClick={handleExportPdf}
                disabled={exporting}
                className={"text-sm px-4 py-1.5 rounded-lg font-medium text-white bg-rose-app" + (exporting ? " opacity-60 cursor-wait" : "")}
              >
                {exporting ? "Exporting..." : "Export PDF"}
              </button>
            </>
          )}
          <button
            onClick={showSharePanel ? () => setShowSharePanel(false) : onClose}
            className="text-sm px-3 py-1.5 rounded-lg border border-app-border text-body"
          >
            {showSharePanel ? "← Back" : "Close"}
          </button>
        </div>
      </div>

      {/* Share panel */}
      {showSharePanel && (
        <div className="px-6 py-4 bg-surface border-b border-app-border shrink-0 print:hidden">
          <div className="max-w-[800px] mx-auto space-y-4">
            {/* Create new share */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-heading">Create Shareable Link</h3>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex rounded-lg border border-app-border overflow-hidden">
                  <button
                    onClick={() => setShareMode("all")}
                    className={
                      "text-xs px-3 py-1.5 font-medium transition-colors " +
                      (shareMode === "all"
                        ? "bg-rose-app text-white"
                        : "bg-surface text-body hover:bg-page-bg")
                    }
                  >
                    All Events
                  </button>
                  <button
                    onClick={() => { if (hasVendors) setShareMode("vendor"); }}
                    className={
                      "text-xs px-3 py-1.5 font-medium transition-colors border-l border-app-border " +
                      (shareMode === "vendor"
                        ? "bg-rose-app text-white"
                        : hasVendors
                          ? "bg-surface text-body hover:bg-page-bg"
                          : "bg-surface text-body opacity-40 cursor-not-allowed")
                    }
                  >
                    Vendor View
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Label (optional)"
                  value={shareLabel}
                  onChange={(e) => setShareLabel(e.target.value)}
                  className="text-sm px-3 py-1.5 rounded-lg border border-app-border bg-surface text-body w-48"
                />
                <button
                  onClick={createShare}
                  disabled={creating || (shareMode === "vendor" && shareVendorIds.length === 0)}
                  className={
                    "text-sm px-4 py-1.5 rounded-lg font-medium text-white " +
                    (creating || (shareMode === "vendor" && shareVendorIds.length === 0)
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-rose-app hover:bg-rose-app-hover")
                  }
                >
                  {creating ? "Creating..." : "Generate Link"}
                </button>
              </div>
              {shareMode === "vendor" && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-subtle">Vendors:</span>
                  {vendors.map((v) => (
                    <button
                      key={v.id}
                      onClick={() =>
                        setShareVendorIds((prev) =>
                          prev.includes(v.id) ? prev.filter((id) => id !== v.id) : [...prev, v.id]
                        )
                      }
                      className={
                        "text-xs px-2.5 py-1 rounded-full border transition-colors " +
                        (shareVendorIds.includes(v.id)
                          ? "border-transparent text-white"
                          : "text-body border-app-border hover:bg-page-bg")
                      }
                      style={
                        shareVendorIds.includes(v.id)
                          ? { backgroundColor: v.color || "#9B8EC4" }
                          : {}
                      }
                    >
                      {v.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Active shares */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-heading">
                Active Shares {shares.length > 0 && <span className="text-subtle font-normal">({shares.length})</span>}
              </h3>
              {shares.length === 0 ? (
                <p className="text-xs text-subtle italic">No active shares yet.</p>
              ) : (
                <div className="space-y-2">
                  {shares.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-app-border bg-page-bg"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-heading truncate">
                            {s.label || (s.mode === "all" ? "Full Timeline" : "Vendor Timeline")}
                          </span>
                          <span className={
                            "text-[10px] px-1.5 py-0.5 rounded-full font-medium " +
                            (s.mode === "all" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700")
                          }>
                            {s.mode === "all" ? "All" : "Vendor"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {s.mode === "vendor" && s.vendor_ids.length > 0 && (
                            <span className="text-[11px] text-subtle">
                              {s.vendor_ids.map((vid) => {
                                const v = vendors.find((v) => v.id === vid);
                                return v?.name || "Unknown";
                              }).join(", ")}
                            </span>
                          )}
                          <span className="text-[11px] text-subtle">
                            Created {new Date(s.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => copyLink(s.token)}
                          className="text-xs px-3 py-1 rounded-md border border-app-border text-body hover:bg-surface transition-colors"
                        >
                          {copying === s.token ? "Copied!" : "Copy Link"}
                        </button>
                        <button
                          onClick={() => revokeShare(s.id)}
                          className="text-xs px-3 py-1 rounded-md border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                        >
                          Revoke
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Vendor filter row (hidden when share panel is open — it has its own vendor chips) */}
      {!showSharePanel && mode === "vendor" && (
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
        <div ref={contentRef} data-print-content className="max-w-[1100px] mx-auto bg-white text-black rounded-lg shadow-xl print:shadow-none print:rounded-none print:max-w-none">
          <div className="p-8 print:p-6">
            {/* Header */}
            <div className="text-center mb-6 print:mb-4 border-b-2 border-gray-200 pb-5 print:pb-3">
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
              {displayMode === "vendor" && displayVendorIds.length > 0 && (
                <p className="text-sm text-gray-500 mt-2">
                  Showing events for: {displayVendorIds.map((vid) => vendorName(vid)).join(", ")}
                </p>
              )}
            </div>

            {/* ——— ALL EVENTS: Visual timeline layout ——— */}
            {displayMode === "all" && (
              sorted.length === 0 ? (
                <div className="text-center py-16 text-gray-400">No events to display.</div>
              ) : (
                <>
                  {/* Screen */}
                  <div className="relative print:hidden" style={{ height: totalHeight + "px" }}>
                    {hourLabels.map(({ hour, label, top }) => (
                      <div key={hour} className="absolute left-0 right-0" style={{ top: top + "px", zIndex: 1 }}>
                        <div className="flex items-start">
                          <span className="text-[11px] font-semibold text-gray-500 w-[52px] text-right pr-2 -mt-2 shrink-0">{label}</span>
                          <div className="flex-1 border-t border-gray-200"></div>
                        </div>
                      </div>
                    ))}
                    {previewPositioned.map((item: LayoutItem) => renderEventCard(item, EVENT_AREA_LEFT))}
                  </div>
                  {/* Print — adjusted positions to avoid page splits */}
                  {(() => {
                    const adj = adjustForPrint(previewPositioned, hourLabels, totalHeight);
                    return (
                      <div className="relative hidden print:block" style={{ height: adj.totalHeight + "px" }}>
                        {adj.hours.map(({ hour, label, top }) => (
                          <div key={hour} className="absolute left-0 right-0" style={{ top: top + "px", zIndex: 1 }}>
                            <div className="flex items-start">
                              <span className="text-[11px] font-semibold text-gray-500 w-[52px] text-right pr-2 -mt-2 shrink-0">{label}</span>
                              <div className="flex-1 border-t border-gray-200"></div>
                            </div>
                          </div>
                        ))}
                        {adj.items.map((item: LayoutItem) => renderEventCard(item, EVENT_AREA_LEFT))}
                      </div>
                    );
                  })()}
                </>
              )
            )}

            {/* ——— VENDOR TIMELINE: Visual timeline with free blocks ——— */}
            {displayMode === "vendor" && (
              vendorFiltered.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  {displayVendorIds.length === 0
                    ? "Select one or more vendors above to see their events."
                    : "No events to display."}
                </div>
              ) : (() => {
                const firstMin = timeToMinutes(vendorFiltered[0].start_time);
                const lastItem = vendorFiltered[vendorFiltered.length - 1];
                const lastEndMin = timeToMinutes(lastItem.start_time) + lastItem.duration_minutes;
                const vStartHour = Math.floor(firstMin / 60);
                const vStartMin = vStartHour * 60;
                const vEndMin = lastEndMin;
                const vTotalHeight = (vEndMin - vStartMin) * PREVIEW_PX_PER_MIN;

                const vLastHour = Math.floor(lastEndMin / 60);
                const vHourLabels: { hour: number; label: string; top: number }[] = [];
                for (let h = vStartHour; h <= vLastHour; h++) {
                  if (h * 60 > vEndMin) break;
                  vHourLabels.push({ hour: h, label: formatHourLabel(h), top: (h * 60 - vStartMin) * PREVIEW_PX_PER_MIN });
                }

                const freeBlocks: { startMin: number; endMin: number }[] = [];
                for (let i = 0; i < vendorFiltered.length - 1; i++) {
                  const cur = vendorFiltered[i];
                  const curEnd = timeToMinutes(cur.start_time) + cur.duration_minutes;
                  const nextStart = timeToMinutes(vendorFiltered[i + 1].start_time);
                  if (nextStart > curEnd) {
                    freeBlocks.push({ startMin: curEnd, endMin: nextStart });
                  }
                }

                const vPositioned = layoutEvents(vendorFiltered, vStartMin).map((item) => {
                  const startMin = timeToMinutes(item.start_time);
                  const top = (startMin - vStartMin) * PREVIEW_PX_PER_MIN;
                  const height = Math.max(item.duration_minutes * PREVIEW_PX_PER_MIN, 18);
                  return { ...item, _top: top, _height: height };
                });

                // For print: scale down to fit one page (~700px)
                const PRINT_TARGET_HEIGHT = 700;
                const vTotalMin = vEndMin - vStartMin;
                const printPxPerMin = vTotalMin * PREVIEW_PX_PER_MIN > PRINT_TARGET_HEIGHT
                  ? Math.max(PRINT_TARGET_HEIGHT / vTotalMin, 0.5)
                  : PREVIEW_PX_PER_MIN;
                const vPrintHeight = vTotalMin * printPxPerMin;

                const vPrintPositioned = layoutEvents(vendorFiltered, vStartMin).map((item) => {
                  const startMin = timeToMinutes(item.start_time);
                  const top = (startMin - vStartMin) * printPxPerMin;
                  const height = Math.max(item.duration_minutes * printPxPerMin, 18);
                  return { ...item, _top: top, _height: height };
                });

                const vPrintHourLabels: { hour: number; label: string; top: number }[] = [];
                for (let h = vStartHour; h <= vLastHour; h++) {
                  if (h * 60 > vEndMin) break;
                  vPrintHourLabels.push({ hour: h, label: formatHourLabel(h), top: (h * 60 - vStartMin) * printPxPerMin });
                }

                const renderVendorTimeline = (items: LayoutItem[], hours: { hour: number; label: string; top: number }[], height: number, className: string, scale: number) => (
                  <div className={"relative " + className} style={{ height: height + "px" }}>
                    {hours.map(({ hour, label, top }) => (
                      <div key={hour} className="absolute left-0 right-0" style={{ top: top + "px", zIndex: 1 }}>
                        <div className="flex items-start">
                          <span className="text-[11px] font-semibold text-gray-500 w-[52px] text-right pr-2 -mt-2 shrink-0">{label}</span>
                          <div className="flex-1 border-t border-gray-200"></div>
                        </div>
                      </div>
                    ))}
                    {freeBlocks.map((block, i) => {
                      const t = (block.startMin - vStartMin) * scale;
                      const h = (block.endMin - block.startMin) * scale;
                      return (
                        <div key={`free-${i}`} className="absolute rounded-md border border-dashed border-gray-300 overflow-hidden"
                          style={{ left: `${EVENT_AREA_LEFT}px`, width: `calc(100% - ${EVENT_AREA_LEFT}px)`, top: t + "px", height: h + "px", zIndex: 5,
                            background: "repeating-linear-gradient(135deg, transparent, transparent 4px, #f3f4f6 4px, #f3f4f6 5px)" }}>
                          <div className="h-full flex items-center justify-center">
                            <span className="text-[11px] text-gray-400 font-medium bg-white/80 px-2 py-0.5 rounded">{formatDuration(block.endMin - block.startMin)} free</span>
                          </div>
                        </div>
                      );
                    })}
                    {items.map((item: LayoutItem) => renderEventCard(item, EVENT_AREA_LEFT, displayVendorIds))}
                  </div>
                );

                return (
                  <>
                    {renderVendorTimeline(vPositioned, vHourLabels, vTotalHeight, "print:hidden", PREVIEW_PX_PER_MIN)}
                    {renderVendorTimeline(vPrintPositioned, vPrintHourLabels, vPrintHeight, "hidden print:block", printPxPerMin)}
                  </>
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
