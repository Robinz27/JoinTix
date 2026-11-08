// Slip2Go (slip2go.com): asks the bank about the transfer a slip's QR stands for. The same call next.js-shop makes
// (lib/slip.ts there). Without SLIP2GO_KEY in .env.local nothing is asked and every slip waits for a person.
// Server only.

const URL_BASE = (process.env.SLIP2GO_URL ?? "https://connect.slip2go.com").replace(/\/$/, "");
const KEY = process.env.SLIP2GO_KEY ?? "";

export const slip2goReady = () => KEY !== "";

export type SlipData = {
  amount: number;
  transRef: string;
  dateTime: string;
  sender?: { account?: { name?: string } };
  receiver?: { account?: { name?: string; proxy?: { account?: string }; bank?: { account?: string } } };
};

export type SlipCheck =
  | { ok: true; code: string; data: SlipData }
  | { ok: false; code: string; http: number; message: string; /** The answer won't change by asking again: a person can't approve it either */ final: boolean };

/** Codes that say the slip itself is wrong: someone else's account, not a real slip, an unreadable QR */
const FINAL = new Set(["200401", "200500", "400001"]);

const MESSAGES: Record<string, string> = {
  "200401": "บัญชีผู้รับเงินในสลิปไม่ใช่บัญชีของงานนี้",
  "200404": "ธนาคารยังไม่พบรายการโอนนี้",
  "200500": "สลิปไม่ถูกต้อง กรุณาใช้สลิปจริงจากแอปธนาคาร",
  "400001": "QR Code บนสลิปไม่ถูกต้อง",
  "401001": "ระบบตรวจสลิปตั้งค่าไม่ถูกต้อง (API key)",
  "401004": "แพ็กเกจระบบตรวจสลิปหมดอายุ",
  "401005": "โควตาระบบตรวจสลิปหมด",
  "401006": "เครดิตระบบตรวจสลิปไม่พอ",
  "429000": "ระบบตรวจสลิปมีคำขอมากเกินไป",
  "500500": "ระบบธนาคารมีปัญหา",
};

const digits = (v: unknown) => String(v ?? "").replace(/\D/g, "");

/** Asks about one slip; never throws. `receiver` (PromptPay or account number) is checked by the service and again here */
export async function checkSlip(qr: string, receiver: string): Promise<SlipCheck> {
  if (!KEY) return { ok: false, code: "", http: 0, message: "ยังไม่ได้ตั้งค่าระบบตรวจสลิป", final: false };
  const want = digits(receiver);
  try {
    const res = await fetch(`${URL_BASE}/api/verify-slip/qr-code/info`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
      // No checkDuplicate: the unique index on payments is what stops a slip paying twice
      body: JSON.stringify({ payload: { qrCode: qr, checkCondition: { checkDuplicate: false, ...(want ? { checkReceiver: [{ accountNumber: want }] } : {}) } } }),
      signal: AbortSignal.timeout(20_000),
    });
    const result = (await res.json().catch(() => null)) as { code?: unknown; message?: unknown; data?: SlipData } | null;
    const code = String(result?.code ?? "");
    if (res.ok && (code === "200200" || code === "200000") && result?.data) {
      if (!matchesReceiver(result.data, want)) return { ok: false, code: "200401", http: res.status, message: MESSAGES["200401"], final: true };
      return { ok: true, code, data: result.data };
    }
    return { ok: false, code, http: res.status, message: MESSAGES[code] ?? (String(result?.message ?? "") || `ตรวจสลิปไม่สำเร็จ (${res.status})`), final: FINAL.has(code) };
  } catch (e) {
    console.error("[slip2go] call failed", e);
    return { ok: false, code: "", http: 0, message: "ติดต่อระบบตรวจสลิปไม่ได้", final: false };
  }
}

/** Slips show the receiver masked (xxx-x-x5480-x), so only the last 4 digits can be compared */
function matchesReceiver(data: SlipData, want: string) {
  if (want.length < 4) return true;
  const last4 = want.slice(-4);
  const account = data.receiver?.account;
  return [account?.proxy?.account, account?.bank?.account].some((c) => {
    const d = digits(c);
    return d !== "" && d.slice(-4) === last4;
  });
}
