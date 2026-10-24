export type Banner = {
  id: string;
  /** Read out to screen readers; the picture carries the text visually */
  title: string;
  href: string;
  /** 5:2 picture, e.g. 1500×600; wider ones are trimmed a little at the sides */
  src: string;
};

// Banners in public/banners until events come from the database
export const BANNERS: Banner[] = [
  { id: "aeden-bangkok", title: "Anyma presents ÆDEN Bangkok 5 ธันวาคม 2569 ที่ MCOT Land", href: "/events/aeden-bangkok", src: "/banners/aeden-bangkok.png" },
  { id: "burning-city", title: "Burning City 30–31 ตุลาคม 7 เวที 60 ดีเจ", href: "/events/burning-city", src: "/banners/burning-city.jpeg" },];
