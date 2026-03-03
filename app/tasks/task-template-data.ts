export interface TemplateTask {
  title: string;
  category: string;
  priority: "High" | "Medium" | "Low";
  subtasks?: { title: string; is_complete: boolean }[];
}

export const TASK_TEMPLATES: TemplateTask[] = [
  // ── Venue ──
  { title: "Book ceremony venue", category: "Venue", priority: "High", subtasks: [
    { title: "Research venues", is_complete: false },
    { title: "Schedule site visits", is_complete: false },
    { title: "Get quotes", is_complete: false },
    { title: "Sign contract & pay deposit", is_complete: false },
  ]},
  { title: "Book reception venue", category: "Venue", priority: "High", subtasks: [
    { title: "Compare pricing & capacity", is_complete: false },
    { title: "Confirm availability", is_complete: false },
    { title: "Sign contract & pay deposit", is_complete: false },
  ]},
  { title: "Book rehearsal dinner venue", category: "Venue", priority: "Medium" },
  { title: "Schedule venue walkthrough", category: "Venue", priority: "Medium" },

  // ── Catering ──
  { title: "Hire caterer", category: "Catering", priority: "High", subtasks: [
    { title: "Request proposals", is_complete: false },
    { title: "Schedule tastings", is_complete: false },
    { title: "Choose menu", is_complete: false },
    { title: "Sign contract", is_complete: false },
  ]},
  { title: "Order wedding cake", category: "Catering", priority: "Medium", subtasks: [
    { title: "Research bakeries", is_complete: false },
    { title: "Schedule cake tasting", is_complete: false },
    { title: "Choose design & flavors", is_complete: false },
  ]},
  { title: "Plan cocktail hour menu", category: "Catering", priority: "Medium" },
  { title: "Confirm final guest count with caterer", category: "Catering", priority: "High" },
  { title: "Arrange bar & beverages", category: "Catering", priority: "Medium" },

  // ── Attire ──
  { title: "Shop for wedding dress", category: "Attire", priority: "High", subtasks: [
    { title: "Browse styles & set budget", is_complete: false },
    { title: "Visit bridal shops", is_complete: false },
    { title: "Order dress", is_complete: false },
    { title: "Schedule fittings", is_complete: false },
  ]},
  { title: "Shop for groom's attire", category: "Attire", priority: "High" },
  { title: "Choose bridesmaids' dresses", category: "Attire", priority: "Medium" },
  { title: "Choose groomsmen's attire", category: "Attire", priority: "Medium" },
  { title: "Purchase wedding accessories", category: "Attire", priority: "Low" },
  { title: "Book hair & makeup team", category: "Attire", priority: "Medium", subtasks: [
    { title: "Research artists", is_complete: false },
    { title: "Schedule trial session", is_complete: false },
    { title: "Book for wedding day", is_complete: false },
  ]},
  { title: "Purchase wedding rings", category: "Attire", priority: "High" },

  // ── Flowers & Decor ──
  { title: "Hire florist", category: "Flowers & Decor", priority: "Medium", subtasks: [
    { title: "Collect inspiration photos", is_complete: false },
    { title: "Get quotes from florists", is_complete: false },
    { title: "Choose arrangements & sign contract", is_complete: false },
  ]},
  { title: "Plan ceremony decor", category: "Flowers & Decor", priority: "Medium" },
  { title: "Plan reception centerpieces", category: "Flowers & Decor", priority: "Medium" },
  { title: "Rent linens & tableware", category: "Flowers & Decor", priority: "Low" },

  // ── Photography ──
  { title: "Hire photographer", category: "Photography", priority: "High", subtasks: [
    { title: "Review portfolios", is_complete: false },
    { title: "Schedule consultations", is_complete: false },
    { title: "Sign contract & pay deposit", is_complete: false },
  ]},
  { title: "Hire videographer", category: "Photography", priority: "Medium" },
  { title: "Schedule engagement photoshoot", category: "Photography", priority: "Low" },
  { title: "Create shot list for photographer", category: "Photography", priority: "Low" },

  // ── Music & Entertainment ──
  { title: "Book DJ or band", category: "Music & Entertainment", priority: "High", subtasks: [
    { title: "Listen to demos", is_complete: false },
    { title: "Confirm availability", is_complete: false },
    { title: "Sign contract", is_complete: false },
  ]},
  { title: "Plan ceremony music", category: "Music & Entertainment", priority: "Medium" },
  { title: "Create reception playlist / requests", category: "Music & Entertainment", priority: "Low" },
  { title: "Plan special dances", category: "Music & Entertainment", priority: "Low" },

  // ── Stationery ──
  { title: "Send save-the-dates", category: "Stationery", priority: "High" },
  { title: "Order & send wedding invitations", category: "Stationery", priority: "High", subtasks: [
    { title: "Choose design", is_complete: false },
    { title: "Finalize guest list & addresses", is_complete: false },
    { title: "Order invitations", is_complete: false },
    { title: "Assemble & mail", is_complete: false },
  ]},
  { title: "Order ceremony programs", category: "Stationery", priority: "Low" },
  { title: "Order menus & place cards", category: "Stationery", priority: "Low" },
  { title: "Order thank-you cards", category: "Stationery", priority: "Medium" },

  // ── Legal ──
  { title: "Book officiant", category: "Legal", priority: "High" },
  { title: "Get marriage license", category: "Legal", priority: "High" },
  { title: "Change name on documents (if applicable)", category: "Legal", priority: "Low" },

  // ── Transportation ──
  { title: "Arrange wedding-day transportation", category: "Transportation", priority: "Medium", subtasks: [
    { title: "Book bridal party transport", is_complete: false },
    { title: "Arrange guest shuttle", is_complete: false },
    { title: "Plan getaway car", is_complete: false },
  ]},
  { title: "Book hotel room block for guests", category: "Transportation", priority: "Medium" },

  // ── Gifts & Favors ──
  { title: "Create wedding registry", category: "Gifts & Favors", priority: "Medium" },
  { title: "Choose guest favors", category: "Gifts & Favors", priority: "Low" },
  { title: "Buy gifts for wedding party", category: "Gifts & Favors", priority: "Low" },
  { title: "Write & send thank-you notes", category: "Gifts & Favors", priority: "Medium" },

  // ── General ──
  { title: "Set wedding budget", category: "General", priority: "High" },
  { title: "Hire wedding planner / coordinator", category: "General", priority: "Medium" },
  { title: "Create wedding website", category: "General", priority: "Medium" },
  { title: "Plan honeymoon", category: "General", priority: "Medium", subtasks: [
    { title: "Research destinations", is_complete: false },
    { title: "Book flights", is_complete: false },
    { title: "Book accommodations", is_complete: false },
  ]},
  { title: "Finalize seating chart", category: "General", priority: "Medium" },
  { title: "Write personal vows", category: "General", priority: "Medium" },
  { title: "Plan wedding rehearsal", category: "General", priority: "Medium" },
  { title: "Confirm final vendor details", category: "General", priority: "High" },
  { title: "Assign day-of emergency contact", category: "General", priority: "Low" },
  { title: "Break in wedding shoes", category: "General", priority: "Low" },
];
