import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

// Better Auth's own endpoints (/api/auth/sign-in/email, /api/auth/get-session, /api/auth/sign-out, …)
export const { GET, POST } = toNextJsHandler(auth);
