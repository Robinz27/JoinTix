import { connection, type NextRequest } from "next/server";
import { getUpcomingEvents, searchEvents } from "@/lib/events";

// The navbar's search (components/search-dialog.tsx). Each search is a LIKE over the events: cheap once, not when
// a script loops it. The dialog asks once per pause in typing, so 60 a minute from one address is far above
// anyone really typing. Counted per server process; move it to Redis along with the rest once that's set up.
const WINDOW_MS = 60_000;
const PER_WINDOW = 60;
const hits = new Map<string, { start: number; count: number }>();

function tooMany(key: string) {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || now - entry.start > WINDOW_MS) {
    if (hits.size > 20_000) hits.clear(); // a flood of addresses can't grow this without bound
    hits.set(key, { start: now, count: 1 });
    return false;
  }
  entry.count++;
  return entry.count > PER_WINDOW;
}

export async function GET(request: NextRequest) {
  await connection();
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100);
  const address = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  if (tooMany(address)) {
    return Response.json({ error: "ค้นหาถี่เกินไป รอสักครู่แล้วลองใหม่" }, { status: 429, headers: { "Retry-After": "60" } });
  }

  try {
    return Response.json({ items: q ? await searchEvents(q) : await getUpcomingEvents() });
  } catch (error) {
    console.error("[search] failed", error);
    return Response.json({ error: "ค้นหาไม่สำเร็จ ลองใหม่อีกครั้ง" }, { status: 500 });
  }
}
