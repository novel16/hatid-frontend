import {
  ApiError,
  type ApiDelivery,
  type ApiParcel,
  type MapCandidate,
  type Vehicle,
} from "./api.ts";

export interface MapPoint {
  latitude: number;
  longitude: number;
}
export interface GpsReading extends MapPoint {
  accuracy: number;
  captured_at: string;
}

/** Default to ready parcels once; refreshes retain deliberate open selections, including hold/failure actions. */
export function deliverySelection(
  parcels: readonly ApiParcel[],
  previous?: readonly number[],
): number[] {
  if (previous) {
    const open = new Set(
      parcels
        .filter(
          /** Delivered/returned parcels cannot participate in another outcome. */ (
            parcel,
          ) => !["delivered", "returned"].includes(parcel.status),
        )
        .map(
          /** Match stable identities instead of positions. */ (parcel) =>
            parcel.id,
        ),
    );
    return previous.filter(
      /** Do not automatically select newly added parcels. */ (id) =>
        open.has(id),
    );
  }
  return parcels
    .filter(
      /** Initial selection includes only currently ready work. */ (parcel) =>
        isReadyParcel(parcel),
    )
    .map(
      /** Keep the API identity for the selected outcome. */ (parcel) =>
        parcel.id,
    );
}

/** Resolve a refreshed manual choice before applying UI side effects; obsolete work returns no decision. */
export async function resolveMapSelection(
  candidates: MapCandidate[],
  manual: ApiDelivery | null,
  readStop: (parcelId: number) => Promise<ApiDelivery>,
  isCurrent: () => boolean,
): Promise<{
  stop: ApiDelivery | null;
  manual: boolean;
  closedManual: boolean;
  unverifiedManual: boolean;
} | null> {
  const recommended =
    candidates.find(
      /** No-route entries remain manual, never the automatic recommendation. */ (
        candidate,
      ) => candidate.duration_seconds !== null,
    ) ?? null;
  if (!manual)
    return {
      stop: recommended,
      manual: false,
      closedManual: false,
      unverifiedManual: false,
    };
  const matched = candidates.find(
    /** Keep the explicit override when it remains in the shortlist. */ (
      candidate,
    ) => candidate.key === manual.key,
  );
  if (matched)
    return {
      stop: matched,
      manual: true,
      closedManual: false,
      unverifiedManual: false,
    };
  try {
    const fresh = await readStop(manual.parcels[0].id);
    if (!isCurrent()) return null;
    if (
      fresh.parcels.some(
        /** Ignore the array index when checking current readiness. */ (
          parcel,
        ) => isReadyParcel(parcel),
      )
    ) {
      return {
        stop: fresh,
        manual: true,
        closedManual: false,
        unverifiedManual: false,
      };
    }
  } catch (cause) {
    if (!isCurrent()) return null;
    // A connection failure is not evidence that a rider's manual choice closed.
    if (!(cause instanceof ApiError) || cause.status !== 404)
      return {
        stop: manual,
        manual: true,
        closedManual: false,
        unverifiedManual: true,
      };
  }
  if (!isCurrent()) return null;
  return {
    stop: recommended,
    manual: false,
    closedManual: true,
    unverifiedManual: false,
  };
}

/** Share ready-work display rules with handover and manual route selection. */
export function isReadyParcel(
  parcel: Pick<ApiParcel, "status" | "retry_at">,
  now = Date.now(),
): boolean {
  return (
    parcel.status === "pending" ||
    (parcel.status === "held" &&
      !!parcel.retry_at &&
      Date.parse(parcel.retry_at) <= now)
  );
}

/** Coordinate zero is valid; incomplete/non-finite pins must remain manual destinations. */
export function hasCoordinates(point: {
  latitude: number | null;
  longitude: number | null;
}): point is MapPoint {
  return (
    typeof point.latitude === "number" &&
    typeof point.longitude === "number" &&
    Number.isFinite(point.latitude) &&
    Number.isFinite(point.longitude) &&
    Math.abs(point.latitude) <= 90 &&
    Math.abs(point.longitude) <= 180
  );
}

/** Open external navigation without API credentials, customer identity or a stale rider origin. */
export function navigationUrl(
  point: { latitude: number | null; longitude: number | null },
  vehicle: Vehicle,
): string | null {
  if (!hasCoordinates(point)) return null;
  const modes = {
    motorcycle: "two-wheeler",
    trijet: "driving",
    bicycle: "bicycling",
    car: "driving",
  };
  const params = new URLSearchParams({
    api: "1",
    destination: `${point.latitude},${point.longitude}`,
    travelmode: modes[vehicle],
    dir_action: "navigate",
  });
  if (vehicle === "trijet") params.set("avoid", "highways");
  return "https://www.google.com/maps/dir/?" + params;
}

/** Keep the client review window consistent with the independently enforced API checks. */
export function isFreshReading(reading: GpsReading, now = Date.now()): boolean {
  const time = Date.parse(reading.captured_at);
  return (
    hasCoordinates(reading) &&
    Number.isFinite(reading.accuracy) &&
    reading.accuracy >= 0 &&
    reading.accuracy <= 10000 &&
    Number.isFinite(time) &&
    time >= now - 300000 &&
    time <= now + 15000
  );
}

/** Ask only after an explicit action, requesting fresh GPS rather than a cached customer position. */
export async function readCurrentLocation(): Promise<GpsReading> {
  if (globalThis.isSecureContext === false)
    throw new Error(
      "Location needs HTTPS on a phone, or localhost on this computer. Continue manually or use a secure preview.",
    );
  if (!navigator.geolocation)
    throw new Error(
      "Location is unavailable in this browser. You can continue manually.",
    );
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      /** Preserve the device capture time/accuracy so an old or weak reading stays visible. */
      (position) => {
        if (!Number.isFinite(position.timestamp)) {
          reject(new Error("Couldn’t get a fresh location. Try again."));
          return;
        }
        const reading = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          captured_at: new Date(position.timestamp).toISOString(),
        };
        if (!isFreshReading(reading)) {
          reject(
            new Error("That location reading is stale or invalid. Try again."),
          );
          return;
        }
        resolve(reading);
      },
      /** Permission, timeout and unavailable GPS never undo a completed handover. */
      (error) =>
        reject(
          new Error(
            error.code === 1
              ? "Allow location permission in your browser, then try again. You can also skip."
              : error.code === 3
                ? "Location timed out. Try again or continue manually."
                : "Couldn’t read your location. Try again outdoors or continue manually.",
          ),
        ),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 },
    );
  });
}
