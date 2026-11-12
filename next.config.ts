import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Cloudflare quick tunnel (cloudflared tunnel --url http://localhost:3000) for showing the dev server to others
  allowedDevOrigins: ["*.trycloudflare.com"],
  experimental: {
    serverActions: {
      // plus the hosts in TRUSTED_ORIGINS (.env.local, see src/lib/auth.ts), e.g. a named tunnel's domain
      allowedOrigins: [
        "*.trycloudflare.com",
        ...(process.env.TRUSTED_ORIGINS ?? "").split(",").map((o) => o.trim().replace(/^https?:\/\//, "")).filter(Boolean),
      ],
      // A poster comes up with the event form (lib/uploads.ts takes up to 10 MB; the browser shrinks it first)
      bodySizeLimit: "11mb",
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
