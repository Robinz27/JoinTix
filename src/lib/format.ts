/**
 * Number and money formatting shared by the site, the admin and emails. Safe to import in "use client" files.
 * Use these instead of declaring another Intl.NumberFormat in each file, so every page shows money the same way.
 */

/** Plain Thai number with thousands separators: 1,234 */
export const num = new Intl.NumberFormat("th-TH");

/** Baht amount: ฿1,234 (and ฿0 for zero) */
export const baht = (n: number) => `฿${num.format(n)}`;

/** Baht amount that says ฟรี for zero, for prices a customer pays */
export const bahtOrFree = (n: number) => (n === 0 ? "ฟรี" : baht(n));

/** Every time on the site is shown in Thai time */
export const TZ = "Asia/Bangkok";

/** "8 พฤศจิกายน 2569 14:03:22", a full date and time */
export const fullDateTime = new Intl.DateTimeFormat("th-TH", { dateStyle: "long", timeStyle: "medium", timeZone: TZ });

/** "2026-11-08" in Thai time, for grouping or comparing by day */
export const dayKey = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: TZ });
