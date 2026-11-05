// Pictures are made smaller in the browser before they are sent, as next.js-shop does (lib/shrink-image.ts
// there): a phone photo is 3–10 MB, and the server keeps posters at 1200×1500 anyway, so sending it whole
// only makes the upload slow on a mobile connection. Redrawing also leaves out what else the file carries
// (EXIF with the phone's location, embedded previews).
//
// The server still checks and re-encodes everything (lib/uploads.ts): this is a courtesy, and any file
// this can't handle is sent as it was.

/** The longest side sent: posters are stored at most 1500px tall */
const MAX_SIDE = 1600;
/** PNG / WebP pictures smaller than this, and within the longest side, are left alone */
const KEEP_BELOW = 400 * 1024;

function encode(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * The file's bytes, copied into memory: on an iPhone a photo picked from the library can stop being
 * readable before the form is sent. Read now, while it surely can be.
 */
async function held(file: File): Promise<File> {
  try {
    return new File([await file.arrayBuffer()], file.name, { type: file.type, lastModified: file.lastModified });
  } catch {
    return file;
  }
}

export async function shrinkImage(file: File, maxSide = MAX_SIDE): Promise<File> {
  // GIFs can be animated, and a canvas keeps one frame
  if (file.type === "image/gif" || !file.type.startsWith("image/")) return held(file);
  try {
    const bitmap = await createImageBitmap(file); // turned the way the photo's orientation says
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const jpeg = file.type === "image/jpeg";
    if (!jpeg && scale === 1 && file.size < KEEP_BELOW) {
      bitmap.close();
      return held(file);
    }

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) return held(file);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    // Photos stay JPEG; PNG / WebP become WebP so transparency survives
    const blob = await encode(canvas, jpeg ? "image/jpeg" : "image/webp", 0.9);
    if (!blob || blob.size === 0 || (blob.size >= file.size && scale === 1)) return held(file);

    const ext = blob.type === "image/jpeg" ? "jpg" : blob.type === "image/webp" ? "webp" : "png";
    const name = file.name.replace(/\.[^.]*$/, "") || "image";
    return new File([blob], `${name}.${ext}`, { type: blob.type, lastModified: file.lastModified });
  } catch {
    return held(file); // a format this browser can't draw: the server will say what's wrong with it
  }
}
