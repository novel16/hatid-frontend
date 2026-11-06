import type { NextConfig } from "next";
import { randomUUID } from "node:crypto";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_HATID_RELEASE:
      process.env.NODE_ENV === "production"
        ? process.env.HATID_RELEASE_ID || randomUUID()
        : "development",
  },
  devIndicators: false,
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
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
