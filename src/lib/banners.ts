export type Banner = {
  id: string;
  /** Read out to screen readers; the picture carries the text visually */
  title: string;
  href: string;
  /** 5:2 picture, e.g. 1500×600 */
  src: string;
};

// Placeholder events with drawn banners (public/banners) until events come from the database
export const BANNERS: Banner[] = [
  { id: "midnight-echo", title: "Midnight Echo Live 14 ธันวาคม 2569 บัตร Pre-sale 1,800 บาท", href: "/events/midnight-echo", src: "/banners/midnight-echo.svg" },
  { id: "reunion-eng60", title: "งานเลี้ยงรุ่นวิศวะ รุ่น 60 วันที่ 27 ธันวาคม 2569", href: "/events/reunion-eng60", src: "/banners/reunion-eng60.svg" },
  { id: "indie-fest", title: "Bangkok Indie Fest 9–10 มกราคม 2570 บัตรเริ่ม 890 บาท", href: "/events/indie-fest", src: "/banners/indie-fest.svg" },
  { id: "countdown-2027", title: "Countdown 2027 วันที่ 31 ธันวาคม 2569 เข้างานฟรี", href: "/events/countdown-2027", src: "/banners/countdown-2027.svg" },
];
