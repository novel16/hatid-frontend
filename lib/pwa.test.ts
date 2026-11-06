import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import {
  createPwaWorker,
  mayReloadForUpdate,
  needsPwaRegistration,
} from "./pwa.ts";

/** Run the actual generated worker with only browser API boundaries supplied by this harness. */
function worker(version = "release-a", scope = "/") {
  const listeners = new Map<string, (event: Record<string, unknown>) => void>();
  const stores = new Map<string, Map<string, Response>>();
  const fetches: { url: string; options?: RequestInit }[] = [];
  const deleted: string[] = [];
  let failNetwork = false;
  let failPut = false;
  let claimed = 0;
  let activated = 0;
  const origin = "https://hatid.test";
  /** Cache keys in a real browser normalize relative asset URLs to absolute request identities. */
  const key = (value: string | { url: string }) =>
    new URL(typeof value === "string" ? value : value.url, origin).href;
  const caches = {
    open: async (name: string) => {
      if (!stores.has(name)) stores.set(name, new Map());
      return {
        match: async (request: string | { url: string }) =>
          stores.get(name)!.get(key(request))?.clone(),
        put: async (request: string | { url: string }, response: Response) => {
          if (failPut) throw new Error("Quota full");
          stores.get(name)!.set(key(request), response.clone());
        },
      };
    },
    keys: async () => [...stores.keys()],
    delete: async (name: string) => {
      deleted.push(name);
      return stores.delete(name);
    },
  };
  const self = {
    location: new URL(`${origin}/sw.js`),
    registration: { scope: origin + scope },
    addEventListener: (
      name: string,
      action: (event: Record<string, unknown>) => void,
    ) => listeners.set(name, action),
    skipWaiting: async () => {
      activated++;
    },
    clients: {
      claim: async () => {
        claimed++;
      },
      get: async (id: string) =>
        id === "owned-window"
          ? { url: origin + "/dashboard", type: "window" }
          : undefined,
    },
  };
  vm.runInNewContext(createPwaWorker(version), {
    self,
    caches,
    URL,
    Request,
    Response,
    console,
    fetch: async (input: string | { url: string }, options?: RequestInit) => {
      const url = key(input);
      fetches.push({ url, options });
      if (failNetwork) throw new TypeError("Network unavailable");
      return new Response(
        url.endsWith("/offline.html")
          ? "PUBLIC OFFLINE PAGE"
          : "NETWORK CONTENT",
        {
          headers: {
            "Content-Type": url.endsWith(".png")
              ? "image/png"
              : url.endsWith(".svg")
                ? "image/svg+xml"
                : "text/html",
          },
        },
      );
    },
  });
  /** Dispatch install/activate/message and await all extendable-event work. */
  async function lifecycle(name: string, values: Record<string, unknown> = {}) {
    const pending: Promise<unknown>[] = [];
    listeners.get(name)?.({
      ...values,
      waitUntil: (promise: Promise<unknown>) => pending.push(promise),
    });
    await Promise.all(pending);
  }
  /** Observe whether fetch was intercepted without giving Node a nonexistent navigate Request mode. */
  async function request(
    path: string,
    values: {
      method?: string;
      mode?: string;
      headers?: Record<string, string>;
    } = {},
  ) {
    let response: Promise<Response> | undefined;
    const pending: Promise<unknown>[] = [];
    listeners.get("fetch")?.({
      request: {
        url: new URL(path, origin).href,
        method: values.method ?? "GET",
        mode: values.mode ?? "cors",
        headers: new Headers(values.headers),
      },
      respondWith: (promise: Promise<Response>) => {
        response = promise;
      },
      waitUntil: (promise: Promise<unknown>) => pending.push(promise),
    });
    const result = response ? await response : undefined;
    await Promise.all(pending);
    return result;
  }
  return {
    stores,
    fetches,
    deleted,
    lifecycle,
    request,
    offline: () => {
      failNetwork = true;
    },
    quota: () => {
      failPut = true;
    },
    counts: () => ({ claimed, activated }),
  };
}

/** A cache cannot become another account-data store, even on the same frontend origin. */
test("worker ignores private API, auth, RSC, external and mutation requests", async () => {
  const sw = worker();
  for (const path of [
    "/api/v1/customers",
    "/auth/me",
    "/dashboard?_rsc=private",
    "/_next/static/chunk.js",
    "https://api.hatid.test/parcels",
    "/offline.html?token=private",
  ])
    assert.equal(await sw.request(path), undefined);
  assert.equal(
    await sw.request("/offline.html", { method: "POST" }),
    undefined,
  );
  assert.equal(
    await sw.request("/offline.html", {
      headers: { Authorization: "Bearer private" },
    }),
    undefined,
  );
  assert.equal(
    await sw.request("/api/v1/customers", { mode: "navigate" }),
    undefined,
  );
  assert.equal(await sw.request("/auth/me", { mode: "navigate" }), undefined);
  assert.equal(sw.fetches.length, 0);
  assert.equal(sw.stores.size, 0);
});

/** Installation fetches only fixed public assets without cookies, and does not force an update. */
test("worker installs only public fallback and icons in its release cache", async () => {
  const sw = worker();
  await sw.lifecycle("install");
  assert.equal(sw.stores.size, 1);
  const assets = [...sw.stores.values()][0];
  assert.ok(assets.has("https://hatid.test/offline.html"));
  assert.ok(assets.has("https://hatid.test/hatid-icon-192.png"));
  assert.ok(assets.has("https://hatid.test/hatid-icon-512.png"));
  assert.ok(
    [...assets.keys()].every(
      /** Every key is one of the explicitly public assets. */ (url) =>
        /^https:\/\/hatid\.test\/(offline\.html|hatid-icon(?:-192|-512|-maskable-512|-180)?\.(?:png|svg))$/.test(
          url,
        ),
    ),
  );
  assert.ok(
    sw.fetches.every(
      /** Public installation never carries account credentials. */ (item) =>
        item.options?.credentials === "omit",
    ),
  );
  assert.deepEqual(sw.counts(), { claimed: 0, activated: 0 });
});

/** Private document success remains network-only; network failure yields one generic public page. */
test("navigation fallback never stores the authenticated document or its URL", async () => {
  const sw = worker();
  await sw.lifecycle("install");
  const online = await sw.request("/deliveries/21?private=query", {
    mode: "navigate",
  });
  assert.equal(await online!.text(), "NETWORK CONTENT");
  sw.offline();
  assert.equal(
    await (await sw.request("/deliveries/21?private=query", {
      mode: "navigate",
    }))!.text(),
    "PUBLIC OFFLINE PAGE",
  );
  assert.ok(
    [...sw.stores.values()].every(
      /** No original navigation URL is retained in CacheStorage. */ (cache) =>
        ![...cache.keys()].some(
          (url) => url.includes("private") || url.includes("deliveries"),
        ),
    ),
  );
});

/** Missing storage still gets a public reconnect message, never an error dump or fictional record. */
test("uncached offline navigation fails safely with a public response", async () => {
  const sw = worker();
  sw.offline();
  const response = await sw.request("/customers", { mode: "navigate" });
  assert.equal(response!.status, 503);
  assert.match(await response!.text(), /offline|reconnect/i);
});

/** A quota failure while caching an icon cannot make a successful online request fail. */
test("public asset response survives a failed cache write", async () => {
  const sw = worker();
  sw.quota();
  const response = await sw.request("/hatid-icon-192.png");
  assert.equal(await response!.text(), "NETWORK CONTENT");
});

/** New activation cleans only its own old public caches, preserving other apps and recovery storage. */
test("activation is scope-specific and release-versioned", async () => {
  const sw = worker("release-b");
  await sw.lifecycle("install");
  const name = [...sw.stores.keys()][0];
  sw.stores.set(name.replace("release-b", "release-a"), new Map());
  sw.stores.set("another-app-cache", new Map());
  const otherScope = worker("release-b", "/other/");
  await otherScope.lifecycle("install");
  const foreignName = [...otherScope.stores.keys()][0];
  sw.stores.set(foreignName, new Map());
  await sw.lifecycle("activate");
  assert.equal(sw.deleted.length, 1);
  assert.ok(sw.stores.has(name));
  assert.ok(sw.stores.has(foreignName));
  assert.ok(sw.stores.has("another-app-cache"));
  assert.equal(sw.counts().claimed, 1);
  assert.notEqual(createPwaWorker("release-a"), createPwaWorker("release-b"));
});

/** Only an explicit owned-window update request can skip the waiting state. */
test("worker activates updates only for the explicit owned client message", async () => {
  const sw = worker();
  await sw.lifecycle("message", {
    data: { type: "SYNC_RECEIPTS" },
    source: { id: "owned-window" },
  });
  await sw.lifecycle("message", {
    data: { type: "HATID_APPLY_UPDATE" },
    source: { id: "unknown-window" },
  });
  assert.equal(sw.counts().activated, 0);
  await sw.lifecycle("message", {
    data: { type: "HATID_APPLY_UPDATE" },
    source: { id: "owned-window" },
  });
  assert.equal(sw.counts().activated, 1);
});

/** Controller changes in another tab or with an open business dialog never reload this page. */
test("reload needs an explicit local choice and closed business dialogs", () => {
  assert.equal(mayReloadForUpdate(false, false), false);
  assert.equal(mayReloadForUpdate(false, true), false);
  assert.equal(mayReloadForUpdate(true, true), false);
  assert.equal(mayReloadForUpdate(true, false), true);
});

/** A rejected first installation leaves a registration object with no worker for update() to use. */
test("failed first install re-registers while a healthy existing worker remains updatable", async () => {
  const sw = worker();
  sw.offline();
  await assert.rejects(sw.lifecycle("install"), /network/i);
  assert.equal(sw.counts().activated, 0);
  assert.equal(needsPwaRegistration(null), true);
  assert.equal(
    needsPwaRegistration({ active: null, waiting: null, installing: null }),
    true,
  );
  assert.equal(
    needsPwaRegistration({ active: {}, waiting: null, installing: null }),
    false,
  );
  assert.equal(
    needsPwaRegistration({ active: null, waiting: {}, installing: null }),
    false,
  );
  assert.equal(
    needsPwaRegistration({ active: null, waiting: null, installing: {} }),
    false,
  );
});
