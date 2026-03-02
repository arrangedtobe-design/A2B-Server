"use client";

import { useMemo } from "react";
import type {
  RsvpPage as RsvpPageType,
  RsvpToken,
  RsvpGuestData,
  RsvpEventData,
  RsvpResponse,
} from "@/lib/rsvp/types";
import { rsvpThemes, rsvpFontsUrl } from "@/lib/rsvp/themes";
import { BlockRenderer } from "@/components/rsvp/block-renderer";

interface RsvpPageProps {
  page: RsvpPageType;
  guest: RsvpGuestData;
  event: RsvpEventData;
  token: RsvpToken;
  existingResponse: RsvpResponse | null;
}

export default function RsvpPage({
  page,
  guest,
  event,
  token,
  existingResponse,
}: RsvpPageProps) {
  const theme = useMemo(
    () => rsvpThemes[page.theme] || rsvpThemes.modern,
    [page.theme],
  );

  if (page.page_type === "upload" && page.upload_url) {
    return (
      <>
        <link rel="stylesheet" href={rsvpFontsUrl} />
        <div
          className="min-h-screen bg-cover bg-center bg-no-repeat relative"
          style={{
            backgroundImage: `url(${page.upload_url})`,
            fontFamily: theme.fonts.body,
          }}
        >
          {/* Overlay buttons for upload mode */}
          {page.overlay_config?.buttons?.map((btn) => (
            <a
              key={btn.id}
              href={btn.action === "link" ? btn.linkUrl : "#rsvp-form"}
              className="absolute px-6 py-3 rounded-lg text-white font-semibold shadow-lg transition-transform hover:scale-105"
              style={{
                left: `${btn.x}%`,
                top: `${btn.y}%`,
                transform: "translate(-50%, -50%)",
                backgroundColor: theme.colors.accent,
              }}
            >
              {btn.label}
            </a>
          ))}
        </div>
      </>
    );
  }

  // Block mode (default)
  return (
    <>
      <link rel="stylesheet" href={rsvpFontsUrl} />
      <div
        className="min-h-screen"
        style={{
          backgroundColor: theme.colors.background,
          color: theme.colors.text,
          fontFamily: theme.fonts.body,
        }}
      >
        <div className="max-w-4xl mx-auto">
          {page.blocks.map((block) => (
            <BlockRenderer
              key={block.id}
              block={block}
              theme={theme}
              event={event}
              guest={guest}
              token={token}
              formConfig={page.form_config}
              existingResponse={existingResponse}
              coupleNames={page.couple_names}
            />
          ))}
        </div>
      </div>
    </>
  );
}
