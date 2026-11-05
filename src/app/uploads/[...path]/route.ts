import { readUpload } from "@/lib/uploads";

// /uploads/images/<folder>/<file>.webp — the pictures หลังบ้าน uploaded (lib/uploads.ts), served by the site
// itself. Every file is named by random bytes and the time it was written, so a path never changes what it
// shows: browsers and next/image keep it for a year.

export async function GET(_: Request, { params }: RouteContext<"/uploads/[...path]">) {
  const { path } = await params;
  const file = await readUpload(path);
  if (!file) return new Response("Not found", { status: 404, headers: { "Cache-Control": "public, max-age=60" } });
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(file.length),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
