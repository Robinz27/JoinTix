export type EventStatus = "on-sale" | "selling-fast" | "coming-soon" | "sold-out";

export type EventSummary = {
  id: string;
  title: string;
  /** ISO date-time of the show, in Thai time */
  startsAt: string;
  venue: string;
  /** Cheapest ticket in baht; 0 is a free event */
  priceFrom: number;
  status: EventStatus;
  /** 4:5 poster, e.g. 800×1000 */
  poster: string;
  href: string;
};

export type TicketZone = {
  id: string;
  name: string;
  /** Baht per ticket; 0 is free */
  price: number;
  /** What the ticket includes, e.g. standing or a numbered seat */
  note: string;
  /** Tickets left; 0 is sold out */
  remaining: number;
};

export type EventDetail = EventSummary & {
  organizer: string;
  /** ISO date-time the doors open */
  doorsAt: string;
  /** ISO date-time sales start, shown while the event is coming soon */
  salesStartAt: string;
  description: string[];
  /** Most tickets one account may take per order (anti-scalper) */
  maxPerOrder: number;
  zones: TicketZone[];
};

// Placeholder events with drawn posters (public/posters) until events come from the database
export const FEATURED_EVENTS: EventSummary[] = [
  {
    id: "midnight-echo",
    title: "Midnight Echo Live 2026",
    startsAt: "2026-12-14T19:00:00+07:00",
    venue: "อิมแพ็ค อารีน่า เมืองทองธานี",
    priceFrom: 1800,
    status: "selling-fast",
    poster: "/posters/midnight-echo.svg",
    href: "/events/midnight-echo",
  },
  {
    id: "reunion-eng60",
    title: "งานเลี้ยงรุ่นวิศวะ รุ่น 60 คืนสู่เหย้า",
    startsAt: "2026-12-27T18:00:00+07:00",
    venue: "โรงแรมริมน้ำ กรุงเทพฯ",
    priceFrom: 1200,
    status: "on-sale",
    poster: "/posters/reunion-eng60.svg",
    href: "/events/reunion-eng60",
  },
  {
    id: "indie-fest",
    title: "Bangkok Indie Fest 2027",
    startsAt: "2027-01-09T16:00:00+07:00",
    venue: "ลานกลางเมือง กรุงเทพฯ",
    priceFrom: 890,
    status: "coming-soon",
    poster: "/posters/indie-fest.svg",
    href: "/events/indie-fest",
  },
  {
    id: "countdown-2027",
    title: "Countdown 2027 ริมเจ้าพระยา",
    startsAt: "2026-12-31T20:00:00+07:00",
    venue: "ริมแม่น้ำเจ้าพระยา กรุงเทพฯ",
    priceFrom: 0,
    status: "sold-out",
    poster: "/posters/countdown-2027.svg",
    href: "/events/countdown-2027",
  },
];

// Placeholder details and ticket zones for the event page (app/events/[id]) until they come from the database
const DETAILS: Record<string, Omit<EventDetail, keyof EventSummary>> = {
  "midnight-echo": {
    organizer: "Echo Entertainment",
    doorsAt: "2026-12-14T17:30:00+07:00",
    salesStartAt: "2026-11-01T10:00:00+07:00",
    description: [
      "คอนเสิร์ตใหญ่ครั้งแรกของ Midnight Echo กับเพลงฮิตครบทุกอัลบั้ม พร้อมแสง สี เสียงเต็มรูปแบบ",
      "ประตูเปิด 17:30 น. แสดงบัตรและบัตรประชาชนที่ทางเข้า ไม่อนุญาตให้นำกล้องมืออาชีพเข้างาน",
    ],
    maxPerOrder: 4,
    zones: [
      { id: "vip", name: "VIP", price: 6500, note: "ยืนหน้าเวที + ของที่ระลึก", remaining: 0 },
      { id: "a", name: "โซน A", price: 4500, note: "ที่นั่งมีหมายเลข", remaining: 12 },
      { id: "b", name: "โซน B", price: 3200, note: "ที่นั่งมีหมายเลข", remaining: 86 },
      { id: "c", name: "โซน C", price: 1800, note: "ที่นั่งมีหมายเลข", remaining: 240 },
    ],
  },
  "reunion-eng60": {
    organizer: "สมาคมศิษย์เก่าวิศวะ รุ่น 60",
    doorsAt: "2026-12-27T17:00:00+07:00",
    salesStartAt: "2026-10-15T09:00:00+07:00",
    description: [
      "คืนสู่เหย้าวิศวะ รุ่น 60 ดินเนอร์บุฟเฟต์ ดนตรีสด และกิจกรรมจับรางวัล",
      "แต่งกายสุภาพ ธีมสีน้ำเงิน ลงทะเบียนหน้างานตั้งแต่ 17:00 น.",
    ],
    maxPerOrder: 2,
    zones: [
      { id: "table", name: "โต๊ะจีน (ต่อที่นั่ง)", price: 1500, note: "ที่นั่งโต๊ะละ 10 คน", remaining: 64 },
      { id: "standard", name: "บุฟเฟต์", price: 1200, note: "ที่นั่งอิสระ", remaining: 130 },
    ],
  },
  "indie-fest": {
    organizer: "Bangkok Indie Collective",
    doorsAt: "2027-01-09T15:00:00+07:00",
    salesStartAt: "2026-12-01T12:00:00+07:00",
    description: [
      "เทศกาลดนตรีอินดี้กลางเมือง 3 เวที กว่า 20 วง ตั้งแต่บ่ายจนดึก",
      "มีโซนอาหารและตลาดนัดงานคราฟต์ เด็กอายุต่ำกว่า 12 ปีเข้าฟรีเมื่อมากับผู้ปกครอง",
    ],
    maxPerOrder: 6,
    zones: [
      { id: "early", name: "Early Bird", price: 890, note: "บัตรยืน เข้าได้ทุกเวที", remaining: 300 },
      { id: "regular", name: "บัตรทั่วไป", price: 1290, note: "บัตรยืน เข้าได้ทุกเวที", remaining: 800 },
    ],
  },
  "countdown-2027": {
    organizer: "กรุงเทพมหานคร",
    doorsAt: "2026-12-31T18:00:00+07:00",
    salesStartAt: "2026-12-01T10:00:00+07:00",
    description: [
      "นับถอยหลังสู่ปี 2027 ริมแม่น้ำเจ้าพระยา ชมพลุและคอนเสิร์ตฟรี",
      "ต้องลงทะเบียนรับบัตรล่วงหน้าเพื่อจำกัดจำนวนคนในพื้นที่",
    ],
    maxPerOrder: 2,
    zones: [{ id: "free", name: "บัตรเข้างาน", price: 0, note: "ลงทะเบียนฟรี", remaining: 0 }],
  },
};

export function getEvent(id: string): EventDetail | undefined {
  const summary = FEATURED_EVENTS.find((event) => event.id === id);
  const detail = DETAILS[id];
  return summary && detail ? { ...summary, ...detail } : undefined;
}
