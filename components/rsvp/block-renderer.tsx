"use client";

import type {
  RsvpBlock,
  RsvpTheme,
  RsvpEventData,
  RsvpGuestData,
  RsvpToken,
  RsvpFormConfig,
  RsvpResponse,
  HeroBlockData,
  TextBlockData,
  EventDetailsBlockData,
  RsvpFormBlockData,
  PhotoBlockData,
  DividerBlockData,
} from "@/lib/rsvp/types";
import { RsvpFormRenderer } from "./rsvp-form-renderer";

interface BlockRendererProps {
  block: RsvpBlock;
  theme: RsvpTheme;
  event: RsvpEventData;
  guest: RsvpGuestData;
  token: RsvpToken;
  formConfig: RsvpFormConfig;
  existingResponse: RsvpResponse | null;
  coupleNames?: string | null;
}

export function BlockRenderer({
  block,
  theme,
  event,
  guest,
  token,
  formConfig,
  existingResponse,
  coupleNames,
}: BlockRendererProps) {
  switch (block.type) {
    case "hero":
      return <HeroRenderer data={block.data as HeroBlockData} theme={theme} />;
    case "text":
      return <TextRenderer data={block.data as TextBlockData} theme={theme} />;
    case "event_details":
      return (
        <EventDetailsRenderer
          data={block.data as EventDetailsBlockData}
          theme={theme}
          event={event}
          coupleNames={coupleNames}
        />
      );
    case "rsvp_form":
      return (
        <RsvpFormWrapper
          data={block.data as RsvpFormBlockData}
          theme={theme}
          guest={guest}
          token={token}
          formConfig={formConfig}
          existingResponse={existingResponse}
        />
      );
    case "photo":
      return (
        <PhotoRenderer data={block.data as PhotoBlockData} theme={theme} />
      );
    case "divider":
      return (
        <DividerRenderer data={block.data as DividerBlockData} theme={theme} />
      );
    default:
      return null;
  }
}

// ── Hero ─────────────────────────────────────────────────────

function HeroRenderer({
  data,
  theme,
}: {
  data: HeroBlockData;
  theme: RsvpTheme;
}) {
  const opacity = (data.overlayOpacity ?? 40) / 100;

  return (
    <div className="relative w-full overflow-hidden" style={{ minHeight: "340px" }}>
      {data.imageUrl ? (
        <img
          src={data.imageUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{ backgroundColor: theme.colors.accent }}
        />
      )}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: `rgba(0,0,0,${opacity})` }}
      />
      <div className="relative z-10 flex flex-col items-center justify-center text-center px-6 py-20"
        style={{ minHeight: "340px" }}
      >
        {data.overlayText && (
          <h1
            className="text-4xl md:text-5xl font-bold mb-3 text-white"
            style={{ fontFamily: theme.fonts.heading }}
          >
            {data.overlayText}
          </h1>
        )}
        {data.subtitle && (
          <p className="text-lg md:text-xl text-white/90">{data.subtitle}</p>
        )}
      </div>
    </div>
  );
}

// ── Text ─────────────────────────────────────────────────────

function TextRenderer({
  data,
  theme,
}: {
  data: TextBlockData;
  theme: RsvpTheme;
}) {
  const sizeClasses = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg",
    xl: "text-xl",
  };

  const alignClasses = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  };

  return (
    <div
      className={`px-6 py-6 ${sizeClasses[data.size || "md"]} ${alignClasses[data.alignment || "center"]}`}
      style={{ color: theme.colors.text }}
    >
      <p className="whitespace-pre-wrap leading-relaxed">{data.content}</p>
    </div>
  );
}

// ── Event Details ────────────────────────────────────────────

function EventDetailsRenderer({
  data,
  theme,
  event,
  coupleNames,
}: {
  data: EventDetailsBlockData;
  theme: RsvpTheme;
  event: RsvpEventData;
  coupleNames?: string | null;
}) {
  const formattedDate = event.wedding_date
    ? new Date(event.wedding_date + "T00:00:00").toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="px-6 py-8 text-center">
      {coupleNames && (
        <p
          className="text-2xl md:text-3xl font-bold mb-4"
          style={{
            fontFamily: theme.fonts.heading,
            color: theme.colors.heading,
          }}
        >
          {coupleNames}
        </p>
      )}
      {data.showDate && formattedDate && (
        <p
          className="text-lg mb-2"
          style={{ color: theme.colors.text }}
        >
          {formattedDate}
        </p>
      )}
      {data.showVenue && event.venue && (
        <p
          className="text-base"
          style={{ color: theme.colors.muted }}
        >
          {event.venue}
        </p>
      )}
      {data.customText && (
        <p
          className="mt-4 text-sm"
          style={{ color: theme.colors.muted }}
        >
          {data.customText}
        </p>
      )}
    </div>
  );
}

// ── RSVP Form Wrapper ────────────────────────────────────────

function RsvpFormWrapper({
  data,
  theme,
  guest,
  token,
  formConfig,
  existingResponse,
}: {
  data: RsvpFormBlockData;
  theme: RsvpTheme;
  guest: RsvpGuestData;
  token: RsvpToken;
  formConfig: RsvpFormConfig;
  existingResponse: RsvpResponse | null;
}) {
  return (
    <div id="rsvp-form" className="px-6 py-8">
      {data.heading && (
        <h2
          className="text-2xl md:text-3xl font-bold text-center mb-2"
          style={{
            fontFamily: theme.fonts.heading,
            color: theme.colors.heading,
          }}
        >
          {data.heading}
        </h2>
      )}
      {data.description && (
        <p
          className="text-center mb-6"
          style={{ color: theme.colors.muted }}
        >
          {data.description}
        </p>
      )}
      <RsvpFormRenderer
        theme={theme}
        guest={guest}
        token={token}
        formConfig={formConfig}
        existingResponse={existingResponse}
      />
    </div>
  );
}

// ── Photo ────────────────────────────────────────────────────

function PhotoRenderer({
  data,
  theme,
}: {
  data: PhotoBlockData;
  theme: RsvpTheme;
}) {
  if (!data.imageUrl) return null;

  const aspectClasses = {
    auto: "",
    square: "aspect-square",
    wide: "aspect-video",
  };

  return (
    <div className="px-6 py-4">
      <div
        className={`overflow-hidden ${aspectClasses[data.aspectRatio || "auto"]}`}
        style={{ borderRadius: theme.borderRadius }}
      >
        <img
          src={data.imageUrl}
          alt={data.caption || ""}
          className="w-full h-full object-cover"
        />
      </div>
      {data.caption && (
        <p
          className="text-center text-sm mt-2"
          style={{ color: theme.colors.muted }}
        >
          {data.caption}
        </p>
      )}
    </div>
  );
}

// ── Divider ──────────────────────────────────────────────────

function DividerRenderer({
  data,
  theme,
}: {
  data: DividerBlockData;
  theme: RsvpTheme;
}) {
  const style = data.style || theme.dividerStyle;

  switch (style) {
    case "line":
      return (
        <div className="px-6 py-4">
          <hr style={{ borderColor: theme.colors.border }} />
        </div>
      );
    case "dots":
      return (
        <div className="px-6 py-4 text-center">
          <span
            className="text-xl tracking-[0.5em]"
            style={{ color: theme.colors.muted }}
          >
            &middot;&middot;&middot;
          </span>
        </div>
      );
    case "flourish":
      return (
        <div className="px-6 py-4 text-center">
          <span
            className="text-2xl"
            style={{ color: theme.colors.accent }}
          >
            &#10087;
          </span>
        </div>
      );
    case "space":
      return <div className="py-6" />;
    default:
      return <div className="py-4" />;
  }
}
