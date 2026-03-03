// ── Block types ──────────────────────────────────────────────

export type BlockType =
  | "hero"
  | "text"
  | "event_details"
  | "rsvp_form"
  | "photo"
  | "divider";

export interface HeroBlockData {
  imageUrl?: string;
  overlayText?: string;
  subtitle?: string;
  overlayOpacity?: number; // 0-100
}

export interface TextBlockData {
  content: string;
  alignment?: "left" | "center" | "right";
  size?: "sm" | "md" | "lg" | "xl";
}

export interface EventDetailsBlockData {
  showDate?: boolean;
  showVenue?: boolean;
  showTime?: boolean;
  customText?: string;
}

export interface RsvpFormBlockData {
  heading?: string;
  description?: string;
}

export interface PhotoBlockData {
  imageUrl: string;
  caption?: string;
  aspectRatio?: "auto" | "square" | "wide";
}

export interface DividerBlockData {
  style: "line" | "dots" | "flourish" | "space";
}

export type BlockData =
  | HeroBlockData
  | TextBlockData
  | EventDetailsBlockData
  | RsvpFormBlockData
  | PhotoBlockData
  | DividerBlockData;

export interface RsvpBlock {
  id: string;
  type: BlockType;
  data: BlockData;
}

// Typed block helpers for narrowing
export interface HeroBlock extends RsvpBlock {
  type: "hero";
  data: HeroBlockData;
}
export interface TextBlock extends RsvpBlock {
  type: "text";
  data: TextBlockData;
}
export interface EventDetailsBlock extends RsvpBlock {
  type: "event_details";
  data: EventDetailsBlockData;
}
export interface RsvpFormBlock extends RsvpBlock {
  type: "rsvp_form";
  data: RsvpFormBlockData;
}
export interface PhotoBlock extends RsvpBlock {
  type: "photo";
  data: PhotoBlockData;
}
export interface DividerBlock extends RsvpBlock {
  type: "divider";
  data: DividerBlockData;
}

// ── Theme ────────────────────────────────────────────────────

export type RsvpThemeName = "romantic" | "modern" | "rustic" | "minimal";

export interface RsvpTheme {
  name: RsvpThemeName;
  label: string;
  fonts: {
    heading: string;
    body: string;
  };
  colors: {
    background: string;
    surface: string;
    heading: string;
    text: string;
    accent: string;
    accentHover: string;
    muted: string;
    border: string;
  };
  dividerStyle: "flourish" | "line" | "dots" | "space";
  borderRadius: string;
}

// ── Form config ──────────────────────────────────────────────

export interface CustomQuestion {
  id: string;
  label: string;
  type: "text" | "select";
  options?: string[]; // for select type
  required?: boolean;
}

export interface RsvpFormConfig {
  showMealPreference: boolean;
  mealOptions: string[];
  showPlusOne: boolean;
  showDietaryNotes: boolean;
  customQuestions: CustomQuestion[];
}

// ── Overlay (upload mode) ────────────────────────────────────

export interface OverlayButton {
  id: string;
  label: string;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  action: "rsvp_form" | "link";
  linkUrl?: string;
}

export interface OverlayConfig {
  buttons: OverlayButton[];
}

// ── Page-level types ─────────────────────────────────────────

export type PageType = "blocks" | "upload";

export interface RsvpPage {
  id: string;
  event_id: string;
  page_type: PageType;
  theme: RsvpThemeName;
  blocks: RsvpBlock[];
  upload_url?: string | null;
  upload_type?: string | null;
  overlay_config?: OverlayConfig | null;
  couple_names?: string | null;
  is_published: boolean;
  slug: string;
  form_config: RsvpFormConfig;
  created_at?: string;
  updated_at?: string;
}

export interface RsvpToken {
  id: string;
  guest_id: string;
  event_id: string;
  token: string;
  invite_sent_at?: string | null;
  viewed_at?: string | null;
  responded_at?: string | null;
}

// ── Party/Group types ────────────────────────────────────────

export interface PartyMember {
  name: string;
  label: string; // "Spouse" | "Child" | "Guest"
  needs_highchair?: boolean;
}

export interface PartyMemberResponse {
  name: string;
  attending: "coming" | "not_coming" | "unsure";
  meal_preference?: string | null;
  dietary_notes?: string | null;
  needs_highchair?: boolean;
}

export interface RsvpResponse {
  id: string;
  token_id: string;
  guest_id: string;
  event_id: string;
  attending: "yes" | "no";
  meal_preference?: string | null;
  plus_one: boolean;
  plus_one_name?: string | null;
  dietary_notes?: string | null;
  custom_answers?: Record<string, string> | null;
  party_responses?: PartyMemberResponse[] | null;
  comment?: string | null;
  created_at?: string;
  updated_at?: string;
}

// ── Event data (subset used by RSVP page) ────────────────────

export interface RsvpEventData {
  id: string;
  name: string;
  wedding_date?: string | null;
  venue?: string | null;
}

export interface RsvpGuestData {
  id: string;
  name: string;
  email?: string | null;
  party_members?: PartyMember[];
}
