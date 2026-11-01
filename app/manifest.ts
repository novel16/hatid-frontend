import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hatid · Rider Workspace",
    short_name: "Hatid",
    description: "A clearer day for independent delivery riders.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#F4F7F4",
    theme_color: "#006B54",
    icons: [
      {
        src: "/hatid-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
