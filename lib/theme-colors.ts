export interface ThemeColorSet {
  timelineCategories: Record<string, string>;
  vendorPalette: string[];
  taskCategories: Record<string, string>;
  priorityColors: Record<string, string>;
  roleColors: Record<string, string>;
  surfaces: {
    cardBg: string;
    pageBg: string;
    dragHighlight: string;
    categoryText: string;
  };
}

export const themes: Record<string, ThemeColorSet> = {
  light: {
    timelineCategories: {
      Preparation: "#E8D5E0",
      Ceremony: "#D4A574",
      Photos: "#7BA7BC",
      Reception: "#9B8EC4",
      Travel: "#6BAF8D",
      Vendor: "#E8A87C",
      General: "#B8B8B8",
    },
    vendorPalette: [
      "#E8D5E0", "#D4A574", "#7BA7BC", "#9B8EC4", "#6BAF8D", "#E8A87C",
      "#B8B8B8", "#D4886C", "#8BC4A6", "#A8B4D4", "#D4C474", "#C47B8E",
      "#74B8D4", "#D4A0D4", "#8ED4B8", "#D4D474",
    ],
    taskCategories: {
      General: "bg-gray-100 text-gray-700",
      Venue: "bg-blue-100 text-blue-700",
      Catering: "bg-orange-100 text-orange-700",
      Attire: "bg-purple-100 text-purple-700",
      "Flowers & Decor": "bg-pink-100 text-pink-700",
      Photography: "bg-yellow-100 text-yellow-700",
      "Music & Entertainment": "bg-indigo-100 text-indigo-700",
      Stationery: "bg-teal-100 text-teal-700",
      Legal: "bg-red-100 text-red-700",
      Transportation: "bg-cyan-100 text-cyan-700",
      "Gifts & Favors": "bg-emerald-100 text-emerald-700",
    },
    priorityColors: {
      low: "bg-blue-100 text-blue-700",
      medium: "bg-amber-100 text-amber-700",
      high: "bg-red-100 text-red-700",
    },
    roleColors: {
      owner: "bg-rose-100 text-rose-700",
      partner: "bg-purple-100 text-purple-700",
      planner: "bg-blue-100 text-blue-700",
      bridal_party: "bg-green-100 text-green-700",
    },
    surfaces: {
      cardBg: "#FFFFFF",
      pageBg: "#F9FAFB",
      dragHighlight: "#FFFBEB",
      categoryText: "#555555",
    },
  },
  dark: {
    timelineCategories: {
      Preparation: "#A3728E",
      Ceremony: "#9B7A54",
      Photos: "#5A8A9E",
      Reception: "#7B6EA4",
      Travel: "#4E8F6D",
      Vendor: "#C88A5C",
      General: "#888888",
    },
    vendorPalette: [
      "#A3728E", "#9B7A54", "#5A8A9E", "#7B6EA4", "#4E8F6D", "#C88A5C",
      "#888888", "#B46E52", "#6BA486", "#8894B4", "#B4A454", "#A45B6E",
      "#5498B4", "#B480B4", "#6EB498", "#B4B454",
    ],
    taskCategories: {
      General: "bg-gray-800 text-gray-300",
      Venue: "bg-blue-900/50 text-blue-300",
      Catering: "bg-orange-900/50 text-orange-300",
      Attire: "bg-purple-900/50 text-purple-300",
      "Flowers & Decor": "bg-pink-900/50 text-pink-300",
      Photography: "bg-yellow-900/50 text-yellow-300",
      "Music & Entertainment": "bg-indigo-900/50 text-indigo-300",
      Stationery: "bg-teal-900/50 text-teal-300",
      Legal: "bg-red-900/50 text-red-300",
      Transportation: "bg-cyan-900/50 text-cyan-300",
      "Gifts & Favors": "bg-emerald-900/50 text-emerald-300",
    },
    priorityColors: {
      low: "bg-blue-900/50 text-blue-300",
      medium: "bg-amber-900/50 text-amber-300",
      high: "bg-red-900/50 text-red-300",
    },
    roleColors: {
      owner: "bg-rose-900/50 text-rose-300",
      partner: "bg-purple-900/50 text-purple-300",
      planner: "bg-blue-900/50 text-blue-300",
      bridal_party: "bg-green-900/50 text-green-300",
    },
    surfaces: {
      cardBg: "#1C1C1E",
      pageBg: "#0A0A0A",
      dragHighlight: "#2A2520",
      categoryText: "#BBBBBB",
    },
  },
};
