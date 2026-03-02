export type TableShape = "round" | "rectangular" | "head" | "dance_floor" | "entrance" | "vendor" | "cake";

export const FIXTURE_SHAPES: TableShape[] = ["dance_floor", "entrance", "vendor", "cake"];

export function isFixture(shape: TableShape): boolean {
  return FIXTURE_SHAPES.includes(shape);
}

export interface SeatingTable {
  id: string;
  event_id: string;
  name: string;
  shape: TableShape;
  capacity: number;
  position_x: number;
  position_y: number;
  sort_order: number;
  color: string | null;
  custom_width: number | null;
  custom_height: number | null;
  rotation: number;
  created_at?: string;
}

export const TABLE_COLORS = [
  { value: "#e57373", label: "Red" },
  { value: "#81c784", label: "Green" },
  { value: "#64b5f6", label: "Blue" },
  { value: "#ffb74d", label: "Orange" },
  { value: "#ba68c8", label: "Purple" },
  { value: "#4db6ac", label: "Teal" },
  { value: "#f06292", label: "Pink" },
  { value: "#a1887f", label: "Brown" },
] as const;

export interface SeatPopoverData {
  tableId: string;
  seatIndex: number;
  guest: SeatingGuest;
  anchorX: number;
  anchorY: number;
}

export interface SeatingAssignment {
  id: string;
  event_id: string;
  table_id: string;
  guest_id: string;
  seat_index: number | null;
  label: string | null;
  party_member_index: number | null;
  created_at?: string;
}

export interface GuestRecord {
  id: string;
  name: string;
  email: string | null;
  rsvp_status: string;
  meal_preference: string | null;
  party_members: { name: string; label: string }[] | null;
}

export interface SeatingGuest {
  guest_id: string;
  party_member_index: number | null;
  display_name: string;
  meal_preference: string | null;
  rsvp_status: string;
  party_label: string | null;
  party_head_name: string;
  party_size: number;
}

export interface SeatingState {
  tables: SeatingTable[];
  assignments: SeatingAssignment[];
}

export type CanvasSizePreset = "S" | "M" | "L" | "XL";

export const CANVAS_SIZE_PRESETS: Record<CanvasSizePreset, { w: number; h: number; label: string }> = {
  S:  { w: 1000, h: 750,  label: "Small" },
  M:  { w: 1400, h: 1050, label: "Medium" },
  L:  { w: 2000, h: 1500, label: "Large" },
  XL: { w: 3000, h: 2250, label: "X-Large" },
};

export interface CanvasViewport {
  offsetX: number;
  offsetY: number;
  zoom: number;
  canvasSize: CanvasSizePreset;
}

export function getTableDimensions(
  shape: string,
  capacity: number,
  customWidth?: number | null,
  customHeight?: number | null,
): { w: number; h: number } {
  if (customWidth != null && customHeight != null) {
    return { w: customWidth, h: customHeight };
  }
  switch (shape) {
    case "round": {
      const size = Math.max(110, 85 + capacity * 5);
      return { w: size, h: size };
    }
    case "rectangular": {
      const seatsPerSide = Math.ceil(capacity / 2);
      return { w: Math.max(160, seatsPerSide * 44), h: 80 };
    }
    case "head": {
      return { w: Math.max(200, capacity * 44), h: 65 };
    }
    case "dance_floor":
      return { w: customWidth ?? 200, h: customHeight ?? 200 };
    case "entrance":
      return { w: customWidth ?? 130, h: customHeight ?? 80 };
    case "vendor":
      return { w: customWidth ?? 130, h: customHeight ?? 90 };
    case "cake":
      return { w: customWidth ?? 120, h: customHeight ?? 90 };
    default:
      return { w: 130, h: 130 };
  }
}
