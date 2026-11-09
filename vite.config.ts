import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import vinext from "vinext";
import { defineConfig } from "vite";

/** Keep the hosted rider build on the HTTPS API while local development uses Next.js. */
export default defineConfig(({ command }) => {
  if (
    command === "build" &&
    !process.env.NEXT_PUBLIC_API_URL?.startsWith("https://")
  ) {
    throw new Error("Set NEXT_PUBLIC_API_URL to the HTTPS Hatid API origin.");
  }

  return {
    plugins: [
      tailwindcss(),
      vinext(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
      }),
    ],
  };
});
