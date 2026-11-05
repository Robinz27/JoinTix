// An event's map pin (events.latitude / longitude): reading one out of what an admin pastes, and the
// Google Maps addresses the site opens. No API key: the links and the embed are Google's public ones.
// Used by both the admin form (client) and the event page (server).

export type Pin = { lat: number; lng: number };

const inRange = ({ lat, lng }: Pin) => Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
const pin = (lat: string, lng: string): Pin | null => {
  const p = { lat: Number(lat), lng: Number(lng) };
  return Number.isFinite(p.lat) && Number.isFinite(p.lng) && inRange(p) ? p : null;
};

const NUM = String.raw`(-?\d{1,3}(?:\.\d+)?)`;

/**
 * The pin in "13.9122, 100.5488", or in a Google Maps link copied from the address bar or the share
 * button: …/@13.91,100.54,17z, ?q=13.91,100.54, ?ll=…, or the place marker's !3d13.91!4d100.54 (more
 * exact than the @ centre, so read first). Short links (maps.app.goo.gl/…) carry no numbers: the form
 * asks the server to follow them (resolveMapLink in app/actions/admin-events.ts).
 */
export function parsePin(input: string): Pin | null {
  const text = decodeURIComponentSafe(input.trim());
  const patterns = [
    new RegExp(String.raw`^${NUM}\s*,\s*${NUM}$`),
    new RegExp(String.raw`!3d${NUM}!4d${NUM}`),
    new RegExp(String.raw`[?&](?:q|query|ll|destination|center)=${NUM},\s*${NUM}`),
    new RegExp(String.raw`@${NUM},${NUM}`),
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const found = match && pin(match[1], match[2]);
    if (found) return found;
  }
  return null;
}

/** Whether a link is a Google Maps short link the server may follow to its full address */
export const isShortMapLink = (input: string) => /^https:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps)\/[\w-]+\/?(\?.*)?$/i.test(input.trim());

/** Opens the pin in Google Maps (the app on a phone), labelled with the venue */
export const mapsLink = ({ lat, lng }: Pin) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

/** Directions from wherever the visitor is */
export const directionsLink = ({ lat, lng }: Pin) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

/** The small map shown on the page (an iframe; needs no key) */
export const embedLink = ({ lat, lng }: Pin, zoom = 16) => `https://maps.google.com/maps?q=${lat},${lng}&z=${zoom}&output=embed`;

/** Searching Google Maps for a venue by name, for an admin looking up its pin */
export const searchLink = (query: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

function decodeURIComponentSafe(text: string) {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}
