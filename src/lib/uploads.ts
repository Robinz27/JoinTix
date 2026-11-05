import { randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

// Pictures หลังบ้าน uploads (event posters), kept by the site itself the way next.js-shop does it
// (lib/uploads.ts there): every file is re-encoded to WebP at the size the site shows it, saved under
// UPLOAD_DIR (storage/uploads by default, git-ignored) and served by app/uploads/[...path]/route.ts at
// /uploads/images/<folder>/<file>.webp, with a year-long cache because a path never changes what it shows.
// Server only.
//
// The files live on the machine that runs the site. The database is shared, so a poster uploaded on one
// computer shows as missing on another's `npm run dev` (HANDOFF section 3).

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const PUBLIC_ROOT = "/uploads/images";

/** How a folder's pictures are stored: shrunk to fit inside width×height, never enlarged */
const BOXES = {
  // 4:5 posters; the event page shows them up to ~450px wide, so this is enough for sharp screens
  posters: { width: 1200, height: 1500, quality: 85 },
  // More pictures of an event (stage, venue, seating plan): any shape, opened full size in the lightbox
  gallery: { width: 1600, height: 1600, quality: 85 },
} as const;
export type UploadFolder = keyof typeof BOXES;

export type SaveImageResult = { ok: true; path: string } | { ok: false; error: string };

/** The bytes decide what a file is, not its name or the browser's content type */
function sniff(buf: Buffer): "jpeg" | "png" | "gif" | "webp" | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.subarray(0, 4).toString("latin1") === "GIF8") return "gif";
  if (buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") return "webp";
  return null;
}

/** Re-encodes one uploaded picture into <uploads>/images/<folder> and returns its public path */
export async function saveUploadedImage(file: File, folder: UploadFolder): Promise<SaveImageResult> {
  if (file.size === 0) return { ok: false, error: "เลือกไฟล์รูปก่อน" };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: "ไฟล์รูปใหญ่เกิน 10 MB" };
  const input = Buffer.from(await file.arrayBuffer());
  if (!sniff(input)) return { ok: false, error: "รองรับเฉพาะไฟล์รูป JPG, PNG, GIF และ WebP" };

  // Re-encoding is also the "is this really a picture?" check, and it drops whatever else the file
  // carried (EXIF with the phone's location, trailing data)
  const box = BOXES[folder];
  let image: Buffer;
  try {
    image = await sharp(input, { limitInputPixels: 50_000_000 })
      .rotate() // the way the photo's orientation says
      .resize(box.width, box.height, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: box.quality })
      .toBuffer();
  } catch (e) {
    console.error("[uploads] re-encode failed", e);
    return { ok: false, error: "ไฟล์รูปเสียหาย หรือเป็นรูปแบบที่ไม่รองรับ" };
  }

  const name = `${randomBytes(12).toString("hex")}_${Math.floor(Date.now() / 1000)}.webp`;
  try {
    const dir = path.join(uploadRoot(), "images", folder);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), image);
  } catch (e) {
    console.error("[uploads] save failed", e);
    return { ok: false, error: "บันทึกรูปไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
  return { ok: true, path: `${PUBLIC_ROOT}/${folder}/${name}` };
}

/** Whether a stored path is one of ours (the only kind deleteUploadedImage will touch) */
export const isUploadPath = (publicPath: string) => publicPath.startsWith(`${PUBLIC_ROOT}/`);

/** Removes an uploaded picture. Whether anything still shows it is the caller's question to answer first */
export async function deleteUploadedImage(publicPath: string): Promise<void> {
  const segments = segmentsOf(publicPath);
  if (!segments) return;
  await unlink(path.join(uploadRoot(), ...segments)).catch(() => {});
}

/** An uploaded picture's bytes for the /uploads route, or null for anything that isn't one */
export async function readUpload(segments: string[]): Promise<Buffer | null> {
  if (!validSegments(segments)) return null;
  return readFile(path.join(uploadRoot(), ...segments)).catch(() => null);
}

function segmentsOf(publicPath: string) {
  if (!isUploadPath(publicPath)) return null;
  const segments = publicPath.slice("/uploads/".length).split("/");
  return validSegments(segments) ? segments : null;
}

/** images/<folder>/<name>.webp and nothing else: no step that could climb out of the folder */
function validSegments(segments: string[]) {
  return (
    segments.length === 3 &&
    segments[0] === "images" &&
    segments[1] in BOXES &&
    /^[a-f0-9]+_\d+\.webp$/.test(segments[2])
  );
}

function uploadRoot() {
  const configured = process.env.UPLOAD_DIR?.trim();
  // Runtime data, not part of the build: kept out of the output file tracing
  return path.resolve(/*turbopackIgnore: true*/ configured || path.join(process.cwd(), "storage", "uploads"));
}
