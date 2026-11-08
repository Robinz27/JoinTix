/** A stored slip (lib/uploads.ts, private) → the route that serves it to staff who may see it (app/admin/slips). Client-safe */
export const slipUrl = (stored: string) => `/admin/slips/${stored.split("/").pop()}`;
