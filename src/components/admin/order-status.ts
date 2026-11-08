// What an order's, a ticket's and a token movement's status is called in หลังบ้าน, and how its badge looks

export const ORDER_STATUS = {
  pending: { label: "รอชำระ", tone: "warn" },
  review: { label: "รอตรวจสลิป", tone: "warn" },
  paid: { label: "ชำระแล้ว", tone: "good" },
  cancelled: { label: "ยกเลิก", tone: "muted" },
  expired: { label: "หมดเวลา", tone: "muted" },
} as const;

export const TICKET_STATUS = {
  valid: { label: "ยังไม่เข้างาน", tone: "muted" },
  used: { label: "เข้างานแล้ว", tone: "good" },
  void: { label: "ยกเลิก", tone: "danger" },
} as const;

export const TOKEN_REASONS: Record<string, string> = {
  ticket_purchase: "ได้จากบัตร",
  topup: "เติมโทเคน",
  topup_void: "ยกเลิกการเติม",
  shop_sale: "ใช้ที่ร้าน",
  shop_sale_void: "ยกเลิกรายการร้าน",
  adjust: "ทีมงานปรับยอด",
};
