// The event values both sides use: lib/events.ts (server, DB) and client components such as ticket-panel.tsx
// and the admin event form, which mustn't import the database code.

/** What the site shows; worked out by saleStatus(), never stored */
export type EventStatus = "on-sale" | "selling-fast" | "coming-soon" | "sold-out" | "closed";
/** What หลังบ้าน sets: draft is hidden, closed is shown with sales stopped */
export const PUBLISH_STATES = ["draft", "published", "closed"] as const;
export type PublishState = (typeof PUBLISH_STATES)[number];
/** What a slug may look like (events.slug): lowercase words joined by - */
export const SLUG_PATTERN = "[a-z0-9]+(?:-[a-z0-9]+)*";

/** Most pictures an event may have besides its poster (events.gallery) */
export const MAX_GALLERY = 10;

export const isBuyable = (status: EventStatus) => status === "on-sale" || status === "selling-fast";
