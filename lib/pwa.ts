/** Controller changes alone never authorize a reload of work in this tab. */
export function mayReloadForUpdate(
  explicitChoice: boolean,
  businessDialogOpen: boolean,
): boolean {
  return explicitChoice && !businessDialogOpen;
}

/** A failed first install can leave an empty registration that update() cannot recover. */
export function needsPwaRegistration(
  value: { active: unknown; waiting: unknown; installing: unknown } | null,
): boolean {
  return !value || !(value.active || value.waiting || value.installing);
}

/** Generate a classic worker with release-specific bytes and a deliberately public-only cache. */
export function createPwaWorker(version: string): string {
  return `"use strict";
const VERSION = ${JSON.stringify(version)};
const PREFIX = "hatid-public:" + encodeURIComponent(new URL(self.registration.scope).pathname) + ":";
const CACHE = PREFIX + VERSION;
const PUBLIC_ASSETS = ["/offline.html", "/hatid-icon.svg", "/hatid-icon-192.png", "/hatid-icon-512.png", "/hatid-icon-maskable-512.png", "/hatid-icon-180.png"];

/** Public cache requests never include cookies or account authorization. */
function publicFetch(path) {
  return fetch(new URL(path, self.location.origin).href, { credentials: "omit", cache: "no-store", redirect: "error" });
}

/** Abort installation if the fallback assets cannot be prepared; keep the old worker active. */
self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    for (const path of PUBLIC_ASSETS) {
      const response = await publicFetch(path);
      if (!response.ok || response.redirected) throw new Error("Public offline assets are unavailable.");
      await cache.put(path, response);
    }
  })());
});

/** Only this app/scope's old public caches are obsolete; account IndexedDB is never touched. */
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith(PREFIX) && name !== CACHE) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

/** An already open window explicitly requests activation; there is no business-sync handler. */
self.addEventListener("message", event => {
  if (event.data?.type !== "HATID_APPLY_UPDATE" || !event.source?.id) return;
  event.waitUntil((async () => {
    const client = await self.clients.get(event.source.id);
    if (client?.type === "window" && new URL(client.url).origin === self.location.origin && client.url.startsWith(self.registration.scope)) await self.skipWaiting();
  })());
});

/** Failed full-document navigation gets a public reconnect page, never a cached rider screen. */
async function navigate(request) {
  try { return await fetch(request); }
  catch {
    try {
      const cache = await caches.open(CACHE);
      const fallback = await cache.match("/offline.html");
      if (fallback) return fallback;
    } catch { /* Storage may be denied or evicted; the inline response stays public. */ }
    return new Response("Hatid is offline. Reconnect and try again. Saved local work remains on this device.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  }
}

/** CacheStorage/quota failure must not break an otherwise successful public asset request. */
async function asset(path) {
  let cache;
  try {
    cache = await caches.open(CACHE);
    const saved = await cache.match(path);
    if (saved) return saved;
  } catch { /* Continue with a credential-free network read. */ }
  const response = await publicFetch(path);
  if (response.ok && !response.redirected && cache) {
    try { await cache.put(path, response.clone()); } catch { /* Return the successful response without caching. */ }
  }
  return response;
}

/** Auth/API/RSC/mutations/maps/arbitrary resources bypass the worker's cache completely. */
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || request.headers.has("authorization")) return;
  if (["api", "auth"].includes(url.pathname.split("/")[1]) || request.headers.has("rsc") || url.searchParams.has("_rsc")) return;
  if (request.mode === "navigate") { event.respondWith(navigate(request)); return; }
  if (!url.search && PUBLIC_ASSETS.includes(url.pathname)) event.respondWith(asset(url.pathname));
});
`;
}
