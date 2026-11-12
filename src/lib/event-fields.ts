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

/** One line of what was bought: "เสื้อที่ระลึก ไซส์ M", or just the name when the item has no options */
export const merchLabel = ({ name, optionLabel, option }: { name: string; optionLabel: string; option: string }) => [name, option && optionLabel, option].filter(Boolean).join(" ");

/** Where to post an order's merchandise, as typed at the ticket panel */
export type ShippingAddress = { name: string; phone: string; address: string; subdistrict: string; district: string; province: string; postcode: string };

export const EMPTY_ADDRESS: ShippingAddress = { name: "", phone: "", address: "", subdistrict: "", district: "", province: "", postcode: "" };

/** What's wrong with an address, or null. The browser and the server ask the same question */
export function addressProblem(a: ShippingAddress): string | null {
  const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  const name = text(a?.name);
  if (!name || name.length > 100) return "กรอกชื่อผู้รับ";
  if (!/^0\d{8,9}$/.test(text(a.phone).replace(/[\s-]/g, ""))) return "กรอกเบอร์โทรผู้รับให้ถูกต้อง";
  const address = text(a.address);
  if (!address || address.length > 300) return "กรอกบ้านเลขที่ ถนน หรืออาคาร";
  if (!text(a.subdistrict) || text(a.subdistrict).length > 80) return "กรอกแขวง / ตำบล";
  if (!text(a.district) || text(a.district).length > 80) return "กรอกเขต / อำเภอ";
  if (!text(a.province) || text(a.province).length > 80) return "กรอกจังหวัด";
  if (!/^\d{5}$/.test(text(a.postcode))) return "กรอกรหัสไปรษณีย์ 5 หลัก";
  return null;
}

/** The address on one line, for the checkout, the email and the label */
export const addressLine = (a: Pick<ShippingAddress, "address" | "subdistrict" | "district" | "province" | "postcode">) => [a.address, a.subdistrict, a.district, a.province, a.postcode].join(" ");

/** Who a ticket is for, as the buyer types it at checkout */
export type Attendee = { firstName: string; lastName: string; email: string };

export const EMPTY_ATTENDEE: Attendee = { firstName: "", lastName: "", email: "" };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** What's wrong with the attendees typed for an order of `quantity` tickets, or null. The browser and the server ask the same */
export function attendeesProblem(list: unknown, quantity: number): string | null {
  if (!Array.isArray(list) || list.length !== quantity) return "กรอกข้อมูลผู้เข้างานให้ครบทุกใบ";
  for (const [i, a] of list.entries()) {
    const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
    const which = quantity > 1 ? ` (บัตรใบที่ ${i + 1})` : "";
    if (!text(a?.firstName) || text(a.firstName).length > 80) return `กรอกชื่อผู้เข้างาน${which}`;
    if (!text(a.lastName) || text(a.lastName).length > 80) return `กรอกนามสกุลผู้เข้างาน${which}`;
    if (!EMAIL.test(text(a.email)) || text(a.email).length > 200) return `กรอกอีเมลผู้เข้างานให้ถูกต้อง${which}`;
  }
  return null;
}

/** "สมชาย ใจดี", or the email when no name was given */
export const attendeeName = (a: Attendee) => [a.firstName, a.lastName].filter(Boolean).join(" ") || a.email;
