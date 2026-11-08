// What a member of staff can be allowed to do in หลังบ้าน. A role (admin_roles, /admin/roles) is a named set
// of these, ticked freely. A new feature adds its permission here and the role form offers it by itself.
// No server code in this file: components/admin imports it too.

export const PERMISSIONS = [
  { key: "events.manage", group: "อีเวนต์", label: "จัดการอีเวนต์", detail: "สร้าง แก้ไข ลบอีเวนต์ ตั้งราคาบัตร สินค้า และราคาโทเคน" },
  { key: "attendees.view", group: "อีเวนต์", label: "ดูผู้ลงทะเบียน", detail: "ค้นหาและดาวน์โหลดรายชื่อผู้ลงทะเบียน" },
  { key: "merch.ship", group: "อีเวนต์", label: "จัดส่งสินค้า", detail: "ดูที่อยู่ลูกค้า ใส่เลขพัสดุ และบันทึกว่าส่งแล้ว" },
  { key: "payments.review", group: "อีเวนต์", label: "ตรวจสลิปโอนเงิน", detail: "ดูสลิปที่รอตรวจ อนุมัติ (ออกบัตร) หรือปฏิเสธ" },
  { key: "door.scan", group: "หน้างาน", label: "สแกนเข้างาน", detail: "เปิดกล้องสแกนบัตร ให้เข้างาน ยกเลิกเช็กอิน และส่งมอบสินค้า" },
  { key: "tokens.topup", group: "หน้างาน", label: "เติมโทเคน", detail: "สแกน QR ของลูกค้าแล้วเติมโทเคน" },
  { key: "tokens.adjust", group: "หน้างาน", label: "ปรับยอดโทเคน", detail: "แก้ยอดโทเคนที่เติมผิด ลดได้จนติดลบ ต้องใส่เหตุผลทุกครั้ง" },
  { key: "shops.sell", group: "ร้านค้า", label: "ขายที่ร้าน", detail: "ตัดโทเคนลูกค้าเฉพาะร้านที่ตัวเองเป็นพนักงาน" },
  { key: "shops.manage", group: "ร้านค้า", label: "จัดการร้านค้า", detail: "เพิ่ม ลบ ร้านค้า ตั้งเมนูและโทเคน กำหนดพนักงาน และขายได้ทุกร้าน" },
  { key: "reports.view", group: "ระบบ", label: "ดูรายงาน", detail: "ดูภาพรวม ยอดขาย ค่าใช้จ่ายแต่ละร้าน และดาวน์โหลดรายงาน" },
  { key: "members.manage", group: "ระบบ", label: "จัดการสมาชิก", detail: "แก้ไขและลบบัญชีลูกค้า (แตะบัญชีทีมงานไม่ได้)" },
  { key: "logs.view", group: "ระบบ", label: "ดูประวัติการใช้งาน", detail: "ดูว่าใครทำอะไร เมื่อไร จาก IP / อุปกรณ์ไหน เปลี่ยนค่าอะไร และดาวน์โหลด CSV" },
] as const;

export type Permission = (typeof PERMISSIONS)[number]["key"];

export const PERMISSION_KEYS: readonly string[] = PERMISSIONS.map((p) => p.key);

/** What someone's account may do: a super admin everything, staff what their role ticks */
export type AdminAccess = { superAdmin: boolean; roleName: string | null; permissions: string[] };

export function can(access: AdminAccess, permission: Permission) {
  return access.superAdmin || access.permissions.includes(permission);
}

/** Any one of them; for pages two kinds of staff share */
export function canAny(access: AdminAccess, permissions: readonly Permission[]) {
  return permissions.some((permission) => can(access, permission));
}
