import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Cloudflare quick tunnel (cloudflared tunnel --url http://localhost:3000) for showing the dev server to others
  allowedDevOrigins: ["*.trycloudflare.com"],
  experimental: {
    serverActions: {
      allowedOrigins: ["*.trycloudflare.com"],
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
