// The PromptPay QR a buyer scans with their banking app: an EMVCo payload built here with no library, the same as
// next.js-shop's lib/paymatch/promptpay.ts. Client-safe.

const AID_PROMPTPAY = "A000000677010111";

/**
 * A PromptPay target as EMVCo wants it, or null when the number can't be one:
 *  - a 10-digit mobile number → tag 01, 0066xxxxxxxxx (13 digits)
 *  - a 13-digit citizen / tax id → tag 02
 *  - a 15-digit e-wallet id → tag 03
 */
function target(value: string): { tag: string; value: string } | null {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 15) return { tag: "03", value: digits };
  if (digits.length === 13) return { tag: "02", value: digits };
  if (digits.length === 10 || digits.length === 9) return { tag: "01", value: digits.replace(/^0/, "66").padStart(13, "0") };
  if (digits.length === 11 && digits.startsWith("66")) return { tag: "01", value: digits.padStart(13, "0") };
  return null;
}

export const isPromptPayTarget = (value: string) => target(value) !== null;

/** tag(2) + length(2) + value */
const field = (tag: string, value: string) => `${tag}${String(value.length).padStart(2, "0")}${value}`;

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF), four upper-case hex digits */
function crc16(data: string) {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= (data.charCodeAt(i) << 8) & 0xffff;
    for (let bit = 0; bit < 8; bit++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** The payload for `amount` baht to `account`; with an amount the banking app fills the figure in by itself */
export function promptPayPayload(account: string, amount: number | null): string {
  const to = target(account);
  if (!to) throw new Error("เลขพร้อมเพย์ไม่ถูกต้อง");
  const once = amount !== null;
  const body =
    field("00", "01") +
    field("01", once ? "12" : "11") +
    field("29", field("00", AID_PROMPTPAY) + field(to.tag, to.value)) +
    field("53", "764") +
    (once ? field("54", amount.toFixed(2)) : "") +
    field("58", "TH") +
    "6304";
  return body + crc16(body);
}

/** "081xxx5678": enough for a buyer to recognise, not enough to copy */
export function maskPromptPay(account: string) {
  const digits = account.replace(/\D/g, "");
  if (digits.length < 4) return digits;
  return `${digits.slice(0, 3)}${"x".repeat(Math.max(0, digits.length - 7))}${digits.slice(-4)}`;
}
