import { createAuthClient } from "better-auth/react";

/** Better Auth in the browser: the navbar reads the session through it (same site, so no baseURL) */
export const authClient = createAuthClient();
