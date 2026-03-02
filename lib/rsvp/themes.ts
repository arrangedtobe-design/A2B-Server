import type { RsvpTheme, RsvpThemeName } from "./types";

export const rsvpThemes: Record<RsvpThemeName, RsvpTheme> = {
  romantic: {
    name: "romantic",
    label: "Romantic",
    fonts: {
      heading: "'Playfair Display', serif",
      body: "'Lato', sans-serif",
    },
    colors: {
      background: "#fdf2f4",
      surface: "#ffffff",
      heading: "#4a2032",
      text: "#5c3d4e",
      accent: "#c06080",
      accentHover: "#a84d6a",
      muted: "#9b8490",
      border: "#e8c8d4",
    },
    dividerStyle: "flourish",
    borderRadius: "12px",
  },

  modern: {
    name: "modern",
    label: "Modern",
    fonts: {
      heading: "'Inter', sans-serif",
      body: "'Inter', sans-serif",
    },
    colors: {
      background: "#f8f9fa",
      surface: "#ffffff",
      heading: "#111827",
      text: "#374151",
      accent: "#2563eb",
      accentHover: "#1d4ed8",
      muted: "#6b7280",
      border: "#e5e7eb",
    },
    dividerStyle: "line",
    borderRadius: "8px",
  },

  rustic: {
    name: "rustic",
    label: "Rustic",
    fonts: {
      heading: "'Crimson Text', serif",
      body: "'Source Sans 3', sans-serif",
    },
    colors: {
      background: "#faf5ef",
      surface: "#ffffff",
      heading: "#5c4033",
      text: "#6b5848",
      accent: "#b87333",
      accentHover: "#9e6229",
      muted: "#9a8b7d",
      border: "#ddd0c0",
    },
    dividerStyle: "dots",
    borderRadius: "6px",
  },

  minimal: {
    name: "minimal",
    label: "Minimal",
    fonts: {
      heading: "'DM Sans', sans-serif",
      body: "'DM Sans', sans-serif",
    },
    colors: {
      background: "#ffffff",
      surface: "#ffffff",
      heading: "#000000",
      text: "#333333",
      accent: "#000000",
      accentHover: "#333333",
      muted: "#999999",
      border: "#eeeeee",
    },
    dividerStyle: "space",
    borderRadius: "4px",
  },
};

/** Google Fonts import URL for all RSVP themes */
export const rsvpFontsUrl =
  "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Lato:wght@300;400;700&family=Crimson+Text:wght@400;600;700&family=Source+Sans+3:wght@300;400;600&family=DM+Sans:wght@400;500;700&family=Inter:wght@400;500;600;700&display=swap";
