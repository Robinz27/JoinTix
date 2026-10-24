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
