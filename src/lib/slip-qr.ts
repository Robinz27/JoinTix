import jsQR from "jsqr";

// Reading the QR off a transfer slip, in the browser (next.js-shop's lib/qr.ts). Slip2Go needs only that short
// payload; the picture itself is still sent so a person can look at it when the check can't decide.
//
// One jsQR pass over the full picture misses real slips: a phone screenshot is 1080×2400 with a small QR in a
// corner, themed slips put pattern right up to the code, and some saves are light-on-dark. So the browser's own
// detector goes first where there is one, then jsQR tries the picture at a few sizes and the corners slips use.

export type ScannedQr = { ok: true; qr: string } | { ok: false; error: string };

type Source = ImageBitmap | HTMLImageElement;
type Region = { x: number; y: number; w: number; h: number };

// Whole picture first, then where slips put their QR: lower half, lower-right quarter, right half
const REGIONS: Region[] = [
  { x: 0, y: 0, w: 1, h: 1 },
  { x: 0, y: 0.45, w: 1, h: 0.55 },
  { x: 0.4, y: 0.5, w: 0.6, h: 0.5 },
  { x: 0.4, y: 0, w: 0.6, h: 1 },
  { x: 0, y: 0.25, w: 1, h: 0.5 },
];

// Long side of the drawn region; jsQR finds small codes better once a big screenshot is scaled down
const SIDES = [0, 1400, 900];

export async function readSlipQr(file: File): Promise<ScannedQr> {
  let source: Source;
  try {
    source = await open(file);
  } catch {
    return { ok: false, error: "เปิดไฟล์รูปไม่สำเร็จ" };
  }
  try {
    const native = await detectNatively(source);
    if (native) return { ok: true, qr: native };

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const { width, height } = source;
    for (const region of REGIONS) {
      const sx = Math.round(region.x * width);
      const sy = Math.round(region.y * height);
      const sw = Math.round(region.w * width);
      const sh = Math.round(region.h * height);
      for (const side of SIDES) {
        const scale = side ? Math.min(1, side / Math.max(sw, sh)) : 1;
        if (side && scale === 1) continue;
        canvas.width = Math.max(1, Math.round(sw * scale));
        canvas.height = Math.max(1, Math.round(sh * scale));
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(source, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(image.data, image.width, image.height, { inversionAttempts: "attemptBoth" });
        if (code?.data) return { ok: true, qr: code.data };
      }
    }
    return { ok: false, error: "ไม่พบ QR Code ในรูปสลิป" };
  } catch {
    return { ok: false, error: "เปิดไฟล์รูปไม่สำเร็จ" };
  } finally {
    if ("close" in source) source.close();
  }
}

async function open(file: File): Promise<Source> {
  try {
    return await createImageBitmap(file);
  } catch {
    // Some browsers refuse createImageBitmap on a file they can still show in an <img>
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

type Detector = { detect(source: Source): Promise<Array<{ rawValue?: string }>> };

/** Chrome on Android and Safari ship a QR reader that copes with far worse pictures than jsQR */
async function detectNatively(source: Source): Promise<string | null> {
  const Native = (globalThis as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
  if (!Native) return null;
  try {
    const found = await new Native({ formats: ["qr_code"] }).detect(source);
    return found.find((f) => f.rawValue)?.rawValue ?? null;
  } catch {
    return null;
  }
}
