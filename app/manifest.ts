import type { MetadataRoute } from "next";
/** Describe one installable rider app, including real raster icons for browser/device launchers. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hatid · Rider Workspace",
    short_name: "Hatid",
    id: "/",
    scope: "/",
    description: "A clearer day for independent delivery riders.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#F4F7F4",
    theme_color: "#006B54",
    icons: [
      {
        src: "/hatid-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/hatid-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/hatid-icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/hatid-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
