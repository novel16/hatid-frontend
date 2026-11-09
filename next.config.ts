import type { NextConfig } from "next";
import { randomUUID } from "node:crypto";

const cloudflareBuild =
  process.env.NODE_ENV === "production" &&
  Boolean(process.env.CLOUDFLARE_ACCOUNT_ID);

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
  // The hosted build does not use Next.js Cache Components or ISR.
  cacheComponents: !cloudflareBuild,
  partialPrefetching: !cloudflareBuild,
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
