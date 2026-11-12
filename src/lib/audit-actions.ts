// What ประวัติการใช้งาน (หลังบ้าน /admin/logs) can record, in Thai, grouped for the filter. No server code here:
// components/admin import it too. A new action anywhere adds its key here first; lib/audit.ts takes nothing else.

export const AUDIT_GROUPS = [
  { key: "auth", label: "บัญชีและการเข้าสู่ระบบ" },
  { key: "member", label: "สมาชิก" },
  { key: "role", label: "สิทธิ์ทีมงาน" },
  { key: "event", label: "อีเวนต์และบัตร" },
  { key: "merch", label: "สินค้าและจัดส่ง" },
  { key: "order", label: "คำสั่งซื้อ" },
  { key: "door", label: "หน้างาน" },
  { key: "token", label: "โทเคน" },
  { key: "shop", label: "ร้านค้า" },
  { key: "system", label: "ระบบ" },
] as const;

export type AuditGroup = (typeof AUDIT_GROUPS)[number]["key"];

/** tone: how the row's badge looks; danger for what removes or fails, good for what lets in or pays */
export const AUDIT_ACTIONS = {
  "auth.signup": { group: "auth", label: "สมัครสมาชิก", tone: "good" },
  "auth.login": { group: "auth", label: "เข้าสู่ระบบ", tone: "muted" },
  "auth.login_failed": { group: "auth", label: "เข้าสู่ระบบไม่สำเร็จ", tone: "warn", sentence: "พยายามเข้าสู่ระบบแต่ไม่สำเร็จ ด้วยอีเมล" },
  "auth.logout": { group: "auth", label: "ออกจากระบบ", tone: "muted" },
  "auth.verification_sent": { group: "auth", label: "ส่งลิงก์/รหัสยืนยันอีเมล", tone: "muted" },
  "auth.email_verified": { group: "auth", label: "ยืนยันอีเมล", tone: "good" },
  "auth.password_reset_requested": { group: "auth", label: "ขอลิงก์รีเซ็ตรหัสผ่าน", tone: "muted" },
  "auth.password_reset": { group: "auth", label: "รีเซ็ตรหัสผ่าน", tone: "warn" },

  "member.update": { group: "member", label: "แก้ไขสมาชิก", tone: "muted" },
  "member.password_set": { group: "member", label: "ตั้งรหัสผ่านใหม่ให้สมาชิก", tone: "warn" },
  "member.sessions_revoke": { group: "member", label: "สั่งออกจากระบบ", tone: "warn" },
  "member.delete": { group: "member", label: "ลบบัญชี", tone: "danger" },

  "role.create": { group: "role", label: "สร้างโรล", tone: "good" },
  "role.update": { group: "role", label: "แก้ไขโรล", tone: "muted" },
  "role.delete": { group: "role", label: "ลบโรล", tone: "danger" },

  "event.create": { group: "event", label: "สร้างอีเวนต์", tone: "good" },
  "event.update": { group: "event", label: "แก้ไขอีเวนต์", tone: "muted" },
  "event.duplicate": { group: "event", label: "ทำสำเนาอีเวนต์", tone: "muted" },
  "event.delete": { group: "event", label: "ลบอีเวนต์", tone: "danger" },

  "merch.save": { group: "merch", label: "บันทึกสินค้า", tone: "muted" },
  "shipment.ship": { group: "merch", label: "บันทึกจัดส่ง", tone: "good" },
  "shipment.unship": { group: "merch", label: "ยกเลิกสถานะส่งแล้ว", tone: "warn" },
  "merch.handover": { group: "merch", label: "ส่งมอบสินค้าที่งาน", tone: "good" },

  "order.create": { group: "order", label: "จองบัตร (รอชำระ)", tone: "muted" },
  "order.pay": { group: "order", label: "ชำระเงิน", tone: "good" },
  "order.cancel": { group: "order", label: "ยกเลิกคำสั่งซื้อ", tone: "warn" },
  "order.expire": { group: "order", label: "หมดเวลาชำระ คืนบัตร", tone: "warn" },
  "order.attendees": { group: "order", label: "กรอกข้อมูลผู้เข้างาน", tone: "muted" },
  "payment.submit": { group: "order", label: "แนบสลิปโอนเงิน", tone: "muted" },
  "payment.approve": { group: "order", label: "อนุมัติสลิป", tone: "good" },
  "payment.reject": { group: "order", label: "ปฏิเสธสลิป", tone: "danger" },

  "ticket.scan": { group: "door", label: "สแกนบัตร", tone: "muted" },
  "ticket.admit": { group: "door", label: "ให้เข้างาน", tone: "good" },
  "ticket.undo_admit": { group: "door", label: "ยกเลิกเช็กอิน", tone: "warn" },
  "ticket.reenter": { group: "door", label: "กลับเข้างานอีกครั้ง", tone: "good" },

  "token.topup": { group: "token", label: "เติมโทเคน", tone: "good" },
  "token.topup_void": { group: "token", label: "ยกเลิกการเติมโทเคน", tone: "warn" },
  "token.adjust": { group: "token", label: "ปรับยอดโทเคน", tone: "warn" },

  "shop.create": { group: "shop", label: "เพิ่มร้าน", tone: "good" },
  "shop.update": { group: "shop", label: "แก้ไขร้าน", tone: "muted" },
  "shop.delete": { group: "shop", label: "ลบร้าน", tone: "danger" },
  "shop_item.create": { group: "shop", label: "เพิ่มเมนู", tone: "good" },
  "shop_item.update": { group: "shop", label: "แก้ไขเมนู", tone: "muted" },
  "shop_item.delete": { group: "shop", label: "ลบเมนู", tone: "danger" },
  "shop_staff.add": { group: "shop", label: "เพิ่มคนของร้าน", tone: "good" },
  "shop_staff.remove": { group: "shop", label: "เอาคนของร้านออก", tone: "warn" },
  "sale.create": { group: "shop", label: "ขายที่ร้าน (ตัดโทเคน)", tone: "good" },
  "sale.void": { group: "shop", label: "ยกเลิกรายการขาย", tone: "warn" },

  "export.csv": { group: "system", label: "ดาวน์โหลด CSV", tone: "muted" },
  "outbox.sent": { group: "system", label: "ส่งอีเมลบัตร", tone: "muted" },
  "outbox.failed": { group: "system", label: "ส่งอีเมลบัตรไม่สำเร็จ", tone: "danger" },
} as const satisfies Record<string, { group: AuditGroup; label: string; tone: "muted" | "good" | "warn" | "danger"; sentence?: string }>;

export type AuditAction = keyof typeof AUDIT_ACTIONS;

/**
 * What happens all day without changing anything worth looking for: every scan at the door, signing in and out,
 * downloads, emails going out. Hidden from ประวัติการใช้งาน until someone asks for everything, or for one of these.
 */
export const ROUTINE_ACTIONS: readonly AuditAction[] = ["ticket.scan", "auth.login", "auth.logout", "auth.verification_sent", "export.csv", "outbox.sent"];

/** Quick ranges for the date filter */
export const LOG_RANGES = [
  { value: "today", label: "วันนี้" },
  { value: "7d", label: "7 วัน" },
  { value: "30d", label: "30 วัน" },
] as const;
export type LogRange = (typeof LOG_RANGES)[number]["value"];

export const isAuditAction = (value: string): value is AuditAction => Object.hasOwn(AUDIT_ACTIONS, value);

export const TARGET_TYPES: Record<string, string> = {
  user: "บัญชี",
  role: "โรล",
  event: "อีเวนต์",
  zone: "โซนบัตร",
  merch: "สินค้า",
  shipment: "การจัดส่ง",
  order: "คำสั่งซื้อ",
  ticket: "บัตร",
  token: "โทเคน",
  shop: "ร้าน",
  shop_item: "เมนู",
  sale: "รายการขาย",
  outbox: "อีเมล",
  report: "รายงาน",
  log: "ประวัติ",
};

/** One before → after line of a change */
export type AuditChange = { field: string; label: string; from: unknown; to: unknown };

/** The page that shows what a row was about, if there is one */
export function targetHref(row: { targetType: string; targetId: string; targetLabel: string; eventId: string | null }): string | null {
  const { targetType: type, targetId: id, targetLabel: label, eventId } = row;
  if (!id) return null;
  if (type === "user") return `/admin/users/${encodeURIComponent(id)}`;
  if (type === "role") return "/admin/roles";
  if (type === "event") return `/admin/events/${id}`;
  if (type === "shop") return `/admin/shops/${id}`;
  if (!eventId) return null;
  if (type === "zone") return `/admin/events/${eventId}/tickets`;
  if (type === "merch") return `/admin/events/${eventId}/merch`;
  if (type === "shipment") return `/admin/events/${eventId}/shipments`;
  // Both are found by their code, which is what the label holds
  if (type === "ticket" || type === "order") return `/admin/events/${eventId}/checkins?q=${encodeURIComponent(label)}`;
  return `/admin/events/${eventId}`;
}

/* ─────────────── Showing a row ─────────────── */

/** What the keys of `details` are called on the page and in the CSV */
export const DETAIL_LABELS: Record<string, string> = {
  quantity: "จำนวน",
  total: "ยอดรวม (บาท)",
  unitPrice: "ราคาต่อใบ (บาท)",
  tokens: "โทเคน",
  baht: "บาท",
  bahtReturned: "เงินที่คืน (บาท)",
  tokenPrice: "ราคาโทเคน (บาท)",
  tokensReturned: "โทเคนที่คืน",
  balanceBefore: "โทเคนก่อนหน้า",
  ticketsIssued: "บัตรที่ออก",
  ticketCode: "รหัสบัตร",
  zone: "โซน",
  event: "อีเวนต์",
  merch: "สินค้า",
  items: "รายการ",
  delivery: "การรับสินค้า",
  shippingFee: "ค่าจัดส่ง (บาท)",
  holdMinutes: "ล็อกบัตร (นาที)",
  payment: "การชำระเงิน",
  heldSince: "จองเมื่อ",
  expiresAt: "หมดเวลาเมื่อ",
  note: "หมายเหตุ",
  result: "ผลการสแกน",
  holder: "ผู้ถือบัตร",
  order: "คำสั่งซื้อ",
  doorEventId: "ประตูของอีเวนต์",
  customer: "ลูกค้า",
  shop: "ร้าน",
  menu: "เมนู",
  people: "คนของร้าน",
  person: "บัญชี",
  method: "วิธี",
  email: "อีเมล",
  name: "ชื่อ",
  phone: "เบอร์โทร",
  rights: "สิทธิ์",
  emailVerified: "ยืนยันอีเมลแล้ว",
  joinedAt: "สมัครเมื่อ",
  reason: "สาเหตุ",
  accountExists: "มีบัญชีนี้",
  rememberMe: "จดจำการเข้าสู่ระบบ",
  sessionExpiresAt: "ล็อกอินหมดอายุ",
  signedInAt: "เข้าสู่ระบบเมื่อ",
  allDevicesSignedOut: "ออกจากระบบทุกเครื่อง",
  devicesSignedOut: "เครื่องที่ถูกออกจากระบบ",
  devices: "อุปกรณ์",
  scope: "ขอบเขต",
  description: "คำอธิบาย",
  permissions: "สิทธิ์",
  backToCustomer: "กลับเป็นลูกค้า",
  slug: "ลิงก์ (slug)",
  organizer: "ผู้จัด",
  venue: "สถานที่",
  startsAt: "วันเริ่มงาน",
  status: "สถานะ",
  zones: "โซนบัตร",
  merchItems: "สินค้า",
  copiedFrom: "คัดลอกจาก",
  uploadedPictures: "รูปที่อัปโหลด",
  toppedUpAt: "เติมเมื่อ",
  toppedUpBy: "เติมโดย (id)",
  soldAt: "ขายเมื่อ",
  carrier: "ขนส่ง",
  trackingNo: "เลขพัสดุ",
  shippedAt: "ส่งเมื่อ",
  kind: "ประเภท",
  attempt: "ครั้งที่",
  of: "จากทั้งหมด",
  error: "ข้อผิดพลาด",
  jobId: "งาน (id)",
  file: "ไฟล์",
  rows: "จำนวนแถว",
  ticketId: "บัตร (id)",
  ip: "IP",
  browser: "เบราว์เซอร์",
};

/** Better Auth's codes, and others the log keeps, in words */
const CODES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
  EMAIL_NOT_VERIFIED: "ยังไม่ยืนยันอีเมล",
  TOO_MANY_REQUESTS: "ลองบ่อยเกินไป",
  USER_NOT_FOUND: "ไม่พบบัญชี",
  ERROR: "ระบบขัดข้อง",
};

/** An IP as people read it: IPv6 with its zeros folded (2001:44c8:4121:9f8e::), and the computer itself as localhost */
export function ipLabel(ip: string | null | undefined): string {
  if (!ip) return "";
  if (!ip.includes(":")) return ip;
  const groups = ip.split(":").map((g) => g.replace(/^0+(?=.)/, "").toLowerCase());
  // The longest run of zero groups becomes ::
  let best = { at: -1, len: 0 };
  for (let i = 0; i < groups.length; ) {
    if (groups[i] !== "0") {
      i++;
      continue;
    }
    let j = i;
    while (j < groups.length && groups[j] === "0") j++;
    if (j - i > best.len) best = { at: i, len: j - i };
    i = j;
  }
  const short = best.len > 1 ? `${groups.slice(0, best.at).join(":")}::${groups.slice(best.at + best.len).join(":")}` : groups.join(":");
  return short === "::" || short === "::1" ? "localhost (เครื่องที่รันเว็บ)" : short;
}

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const stampFormat = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Bangkok" });
const STATUS_TH: Record<string, string> = { draft: "ฉบับร่าง", published: "เผยแพร่", closed: "ปิดการขาย" };

/** A value from a change or the details, as a person reads it */
export function showValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "ใช่" : "ไม่";
  if (typeof value === "number") return value.toLocaleString("th-TH");
  if (typeof value === "string") {
    if (ISO.test(value)) return stampFormat.format(new Date(value));
    return STATUS_TH[value] ?? CODES[value] ?? value;
  }
  if (Array.isArray(value)) return value.length === 0 ? "—" : value.map(showValue).join(", ");
  if (typeof value === "object")
    return Object.entries(value as Record<string, unknown>)
      .map(([key, inner]) => `${DETAIL_LABELS[key] ?? key}: ${showValue(inner)}`)
      .join(" · ");
  return String(value);
}

/** "Chrome · Windows" from a user agent, or the start of it when it's something else */
export function deviceLabel(ua: string | null): string {
  if (!ua) return "";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /SamsungBrowser/.test(ua)
        ? "Samsung Internet"
        : /Line\//.test(ua)
          ? "LINE"
          : /FBAN|FBAV/.test(ua)
            ? "Facebook"
            : /Firefox\//.test(ua)
              ? "Firefox"
              : /Chrome\//.test(ua)
                ? "Chrome"
                : /Safari\//.test(ua)
                  ? "Safari"
                  : "";
  const os = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Windows/.test(ua)
          ? "Windows"
          : /Mac OS X|Macintosh/.test(ua)
            ? "Mac"
            : /Linux/.test(ua)
              ? "Linux"
              : "";
  return [browser, os].filter(Boolean).join(" · ") || ua.slice(0, 40);
}

/* ─────────────── Filtering ─────────────── */

export type LogFilters = {
  /** Free text: the person, the thing, the IP, and anything in the details */
  q?: string;
  /** Who did it: an account id, "system", or "anon" (not signed in) */
  actor?: string;
  /** Everything to do with one account: what they did and what was done to them */
  user?: string;
  /** One action (event.update) or a whole group (group:event) */
  action?: string;
  eventId?: string;
  /** A quick range from now back; wins over from / to */
  range?: LogRange;
  /** "YYYY-MM-DDTHH:mm", Thai time */
  from?: string;
  to?: string;
  /** Show the routine ones too (scans, sign-ins, downloads); off by default */
  all?: boolean;
};

/** Whether anything narrows the list, beyond who it's about */
export function isFiltered(f: LogFilters) {
  return Boolean(f.q || f.actor || f.action || f.eventId || f.range || f.from || f.to);
}

/** The query string of a filtered view, with nothing empty in it */
export function logQuery(filters: LogFilters, extra: Record<string, string> = {}) {
  const params = new URLSearchParams();
  const pairs: [string, string | undefined][] = [
    ["q", filters.q],
    ["actor", filters.actor],
    ["user", filters.user],
    ["action", filters.action],
    ["event", filters.eventId],
    ["range", filters.range],
    ["from", filters.range ? undefined : filters.from],
    ["to", filters.range ? undefined : filters.to],
    ["all", filters.all ? "1" : undefined],
    ...Object.entries(extra),
  ];
  for (const [key, value] of pairs) if (value) params.set(key, value);
  const s = params.toString();
  return s ? `?${s}` : "";
}
