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
