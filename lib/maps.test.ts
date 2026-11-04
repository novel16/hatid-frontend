import assert from "node:assert/strict";
import test from "node:test";
import * as maps from "./maps.ts";
import type { ApiDelivery, MapCandidate } from "./api.ts";

/** Background additions must retain deliberate held/failed selections without selecting new parcels. */
test("delivery refresh preserves selectable IDs while initial selection uses ready parcels", () => {
  const parcel = deliveryFixture(1).parcels[0];
  const parcels = [
    { ...parcel, id: 1, status: "pending" as const },
    {
      ...parcel,
      id: 2,
      status: "held" as const,
      retry_at: "2999-01-01T00:00:00Z",
    },
    { ...parcel, id: 3, status: "failed" as const },
    { ...parcel, id: 4, status: "delivered" as const },
    { ...parcel, id: 5, status: "returned" as const },
    { ...parcel, id: 6, status: "pending" as const },
  ];
  assert.deepEqual(maps.deliverySelection(parcels), [1, 6]);
  assert.deepEqual(
    maps.deliverySelection(parcels, [1, 2, 3, 4, 5, 99]),
    [1, 2, 3],
  );
  assert.deepEqual(maps.deliverySelection(parcels, []), []);
});

/** A delayed rejection from A must not revoke a newer explicit manual selection B. */
test("obsolete manual-stop revalidation has no selection decision after the rider changes views", async () => {
  let rejectRead: (cause: Error) => void = () => {};
  let current = true;
  const manual = deliveryFixture(1);
  const candidate = {
    ...deliveryFixture(2),
    duration_seconds: 200,
    distance_meters: 2000,
  };
  const pending = maps.resolveMapSelection(
    [candidate],
    manual,
    () =>
      new Promise<ApiDelivery>((_resolve, reject) => {
        rejectRead = reject;
      }),
    () => current,
  );
  current = false;
  rejectRead(new Error("Previous stop is unavailable"));
  assert.equal(await pending, null);
});

/** A still-ready override stays selected even when it is outside the latest five candidates. */
test("map selection preserves ready manual work and replaces only a confirmed closed selection", async () => {
  const manual = deliveryFixture(1);
  const candidate: MapCandidate = {
    ...deliveryFixture(2),
    duration_seconds: 200,
    distance_meters: 2000,
  };
  const result = await maps.resolveMapSelection(
    [candidate],
    manual,
    async () => manual,
    () => true,
  );
  assert.equal(result?.stop?.key, "1:1");
  assert.equal(result?.manual, true);
  const closed = {
    ...manual,
    parcels: manual.parcels.map((parcel) => ({
      ...parcel,
      status: "delivered" as const,
    })),
  };
  const fallback = await maps.resolveMapSelection(
    [candidate],
    manual,
    async () => closed,
    () => true,
  );
  assert.equal(fallback?.stop?.key, "2:2");
  assert.equal(fallback?.manual, false);
  assert.equal(fallback?.closedManual, true);
  const noRoute = await maps.resolveMapSelection(
    [{ ...candidate, duration_seconds: null, distance_meters: null }],
    null,
    async () => manual,
    () => true,
  );
  assert.equal(noRoute?.stop, null);
});

/** A complete small API fixture keeps tests independent of production defaults and provider mocks. */
function deliveryFixture(id: number): ApiDelivery {
  const address = {
    id,
    label: "Home",
    text: "Sample Manila stop",
    latitude: 14.6,
    longitude: 120.98,
    verified_at: "2026-11-04T08:00:00Z",
    gps_accuracy: 12,
    gps_captured_at: "2026-11-04T08:00:00Z",
    location_corrected: false,
    location_version: 1,
    archived_at: null,
  };
  const customer = { id, name: `Sample ${id}`, phone: null };
  return {
    key: `${id}:${id}`,
    address,
    customer,
    parcels: [
      {
        id,
        reference: `HTD-${id}`,
        description: "Sample parcel",
        note: null,
        address,
        customer,
        seller: { id, name: "Sample seller" },
        batch: {
          id,
          name: "Sample week",
          start: "2026-11-02",
          end: "2026-11-08",
        },
        pricing: {
          mode: "included",
          quote: 11500,
          fee: 1500,
          total: 11500,
          sellerShare: 10000,
        },
        expected_method: "cash",
        override_reason: null,
        status: "pending",
        retry_at: null,
        receipt: null,
        created_at: "2026-11-04T08:00:00Z",
      },
    ],
  };
}

/** Failed/future-held/closed parcels cannot look ready in the handover or manual route picker. */
test("ready parcel display uses due holds at the exact time boundary", () => {
  const now = Date.parse("2026-11-04T08:00:00Z");
  assert.equal(
    maps.isReadyParcel({ status: "pending", retry_at: null }, now),
    true,
  );
  assert.equal(
    maps.isReadyParcel(
      { status: "held", retry_at: "2026-11-04T08:00:00Z" },
      now,
    ),
    true,
  );
  for (const parcel of [
    { status: "held", retry_at: "2026-11-04T08:00:01Z" },
    { status: "held", retry_at: null },
    { status: "failed", retry_at: null },
    { status: "delivered", retry_at: null },
    { status: "returned", retry_at: null },
  ] as const) {
    assert.equal(maps.isReadyParcel(parcel, now), false);
  }
});

/** Coordinate zero is valid; missing, non-finite or out-of-range values cannot form a navigation destination. */
test("navigation uses saved coordinates and the rider vehicle without exposing app credentials", () => {
  for (const [vehicle, mode] of [
    ["motorcycle", "two-wheeler"],
    ["bicycle", "bicycling"],
    ["car", "driving"],
  ] as const) {
    const value = maps.navigationUrl(
      { latitude: 14.5995, longitude: 120.9842 },
      vehicle,
    );
    assert.ok(value);
    const url = new URL(value);
    assert.equal(url.origin, "https://www.google.com");
    assert.equal(url.searchParams.get("destination"), "14.5995,120.9842");
    assert.equal(url.searchParams.get("travelmode"), mode);
    assert.equal(url.searchParams.get("dir_action"), "navigate");
    assert.equal(url.searchParams.get("origin"), null);
    assert.equal(url.searchParams.get("apiKey"), null);
  }
  assert.ok(maps.navigationUrl({ latitude: 0, longitude: 0 }, "car"));
  for (const point of [
    { latitude: null, longitude: 120 },
    { latitude: 1, longitude: null },
    { latitude: NaN, longitude: 1 },
    { latitude: 91, longitude: 1 },
    { latitude: 1, longitude: -181 },
  ]) {
    assert.equal(maps.navigationUrl(point, "car"), null);
  }
});

/** GPS review must reject stale/future/bad readings rather than enabling a false confirmation. */
test("fresh reading checks mirror the server bounds without accepting invalid dates or accuracy", () => {
  const now = Date.parse("2026-11-04T08:00:00Z");
  const reading = {
    latitude: 14.6,
    longitude: 120.98,
    accuracy: 12,
    captured_at: "2026-11-04T07:59:59Z",
  };
  assert.equal(maps.isFreshReading(reading, now), true);
  for (const changes of [
    { captured_at: "2026-11-04T07:54:59Z" },
    { captured_at: "2026-11-04T08:00:16Z" },
    { captured_at: "bad" },
    { accuracy: -1 },
    { accuracy: Infinity },
    { latitude: NaN },
  ]) {
    assert.equal(maps.isFreshReading({ ...reading, ...changes }, now), false);
  }
});

/** A real browser request opts out of cached GPS and retains the device timestamp and accuracy. */
test("current GPS uses a fresh reading and gives an actionable permission error", async () => {
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "navigator",
  );
  const secureDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "isSecureContext",
  );
  try {
    const captured = Date.now();
    Object.defineProperty(globalThis, "isSecureContext", {
      value: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {
        geolocation: {
          getCurrentPosition(
            success: PositionCallback,
            _failure: PositionErrorCallback,
            options: PositionOptions,
          ) {
            assert.equal(options.maximumAge, 0);
            assert.equal(options.enableHighAccuracy, true);
            success({
              coords: { latitude: 14.6, longitude: 120.98, accuracy: 12 },
              timestamp: captured,
            } as GeolocationPosition);
          },
        },
      },
    });
    assert.deepEqual(await maps.readCurrentLocation(), {
      latitude: 14.6,
      longitude: 120.98,
      accuracy: 12,
      captured_at: new Date(captured).toISOString(),
    });
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {
        geolocation: {
          getCurrentPosition(
            _success: PositionCallback,
            failure: PositionErrorCallback,
          ) {
            failure({ code: 1 } as GeolocationPositionError);
          },
        },
      },
    });
    await assert.rejects(
      maps.readCurrentLocation(),
      /permission|allow location/i,
    );
    Object.defineProperty(globalThis, "isSecureContext", {
      value: false,
      configurable: true,
    });
    await assert.rejects(maps.readCurrentLocation(), /HTTPS|secure/i);
  } finally {
    if (navigatorDescriptor)
      Object.defineProperty(globalThis, "navigator", navigatorDescriptor);
    else Reflect.deleteProperty(globalThis, "navigator");
    if (secureDescriptor)
      Object.defineProperty(globalThis, "isSecureContext", secureDescriptor);
    else Reflect.deleteProperty(globalThis, "isSecureContext");
  }
});
