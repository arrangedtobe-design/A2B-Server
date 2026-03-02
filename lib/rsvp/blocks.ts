import type {
  RsvpBlock,
  BlockType,
  RsvpFormConfig,
  HeroBlockData,
  TextBlockData,
  EventDetailsBlockData,
  RsvpFormBlockData,
  PhotoBlockData,
  DividerBlockData,
} from "./types";

let blockCounter = 0;

function generateBlockId(): string {
  blockCounter += 1;
  return `block_${Date.now()}_${blockCounter}`;
}

const defaultDataByType: Record<BlockType, () => RsvpBlock["data"]> = {
  hero: (): HeroBlockData => ({
    overlayText: "You're Invited",
    subtitle: "We would be honored by your presence",
    overlayOpacity: 40,
  }),
  text: (): TextBlockData => ({
    content: "We can't wait to celebrate with you!",
    alignment: "center",
    size: "md",
  }),
  event_details: (): EventDetailsBlockData => ({
    showDate: true,
    showVenue: true,
    showTime: true,
  }),
  rsvp_form: (): RsvpFormBlockData => ({
    heading: "Will you be joining us?",
    description: "Please let us know by filling out the form below.",
  }),
  photo: (): PhotoBlockData => ({
    imageUrl: "",
    aspectRatio: "wide",
  }),
  divider: (): DividerBlockData => ({
    style: "flourish",
  }),
};

export function createBlock(type: BlockType): RsvpBlock {
  return {
    id: generateBlockId(),
    type,
    data: defaultDataByType[type](),
  };
}

export function getDefaultBlocks(): RsvpBlock[] {
  return [
    createBlock("hero"),
    createBlock("divider"),
    createBlock("text"),
    createBlock("event_details"),
    createBlock("divider"),
    createBlock("rsvp_form"),
  ];
}

export function getDefaultFormConfig(): RsvpFormConfig {
  return {
    showMealPreference: true,
    mealOptions: ["Chicken", "Fish", "Vegetarian", "Vegan"],
    showPlusOne: true,
    showDietaryNotes: true,
    customQuestions: [],
  };
}

export const blockLabels: Record<BlockType, string> = {
  hero: "Hero Banner",
  text: "Text",
  event_details: "Event Details",
  rsvp_form: "RSVP Form",
  photo: "Photo",
  divider: "Divider",
};

export const blockDescriptions: Record<BlockType, string> = {
  hero: "Full-width banner with text overlay",
  text: "Formatted text paragraph",
  event_details: "Date, time, and venue pulled from your event",
  rsvp_form: "The RSVP response form",
  photo: "Single photo with optional caption",
  divider: "Visual separator between sections",
};
