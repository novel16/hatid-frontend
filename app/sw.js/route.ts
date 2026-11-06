import { createPwaWorker } from "@/lib/pwa";

/** A new production build changes worker bytes; no rider data or environment secrets enter this response. */
export function GET(): Response {
  return new Response(
    createPwaWorker(process.env.NEXT_PUBLIC_HATID_RELEASE ?? "development"),
    {
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Service-Worker-Allowed": "/",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy":
          "default-src 'none'; script-src 'self'; connect-src 'self'",
      },
    },
  );
}
