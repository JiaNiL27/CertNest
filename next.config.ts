import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  experimental: {
    // Uploads pass through the proxy: up to two 10 MB files plus form overhead.
    // The per-file 10 MB limit is enforced in src/lib/files/service.ts.
    proxyClientMaxBodySize: "25mb",
  },
  // sharp is a native module; keep it out of the server bundle.
  serverExternalPackages: ["sharp"],
  // Public share pages are reachable by link only: never indexed, never cached.
  async headers() {
    return ["/p/:path*", "/b/:path*"].map((source) => ({
      source,
      headers: [
        { key: "X-Robots-Tag", value: "noindex, nofollow" },
        { key: "Cache-Control", value: "no-store" },
        { key: "Referrer-Policy", value: "no-referrer" },
      ],
    }));
  },
  partialPrefetching: true,
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
