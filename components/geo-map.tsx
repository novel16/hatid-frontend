"use client";

import { useEffect, useState } from "react";
import type {
  Coords,
  DoneCallback,
  LayerGroup,
  Map as LeafletMap,
  TileEvent,
} from "leaflet";
import { useActions } from "@/components/providers";
import { ApiError, validationMessage } from "@/lib/api";
import { hasCoordinates, type MapPoint } from "@/lib/maps";
import { Button } from "@/components/ui";

export interface GeoMarker extends MapPoint {
  key: string;
  label: string;
}
type MapHandle = {
  map: LeafletMap;
  group: LayerGroup;
  api: typeof import("leaflet");
};

/** Reusable client-only map with header-authenticated, quota-controlled tiles and editable pin review. */
export function GeoMap({
  markers,
  origin,
  selectedKey,
  onSelect,
  onPick,
  compact = false,
}: {
  markers: GeoMarker[];
  origin?: MapPoint | null;
  selectedKey?: string;
  onSelect?: (key: string) => void;
  onPick?: (point: MapPoint) => void;
  compact?: boolean;
}) {
  const { request } = useActions();
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [handle, setHandle] = useState<MapHandle | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  /** Import Leaflet after mounting; no window access occurs during server rendering. */
  useEffect(() => {
    if (!container) return;
    let active = true;
    let map: LeafletMap | null = null;
    let stopped = false;
    let queue = Promise.resolve();
    const images = new Map<
      HTMLImageElement,
      { controller: AbortController; url?: string }
    >();

    /** Free a tile's pending request/object URL as soon as Leaflet unloads it. */
    function release(image: HTMLImageElement) {
      const record = images.get(image);
      record?.controller.abort();
      if (record?.url) URL.revokeObjectURL(record.url);
      image.onload = null;
      image.onerror = null;
      images.delete(image);
    }

    /** Pace new requests instead of asking the free provider to serve a map-sized burst. */
    async function initialize() {
      const L = await import("leaflet");
      if (!active) return;
      setError("");
      map = L.map(container!, {
        minZoom: 3,
        maxZoom: 18,
        scrollWheelZoom: false,
      });
      class AuthenticatedTiles extends L.GridLayer {
        /** Bearer credentials stay in headers; vector pins need no additional marker API. */
        createTile(coords: Coords, done: DoneCallback): HTMLElement {
          const image = document.createElement("img");
          image.alt = "";
          image.setAttribute("role", "presentation");
          const record = {
            controller: new AbortController(),
            url: undefined as string | undefined,
          };
          images.set(image, record);
          queue = queue.then(async () => {
            if (!active || record.controller.signal.aborted) return;
            if (stopped) {
              done(new Error("Map loading paused"), image);
              return;
            }
            try {
              let blob: Blob | null = null;
              for (let attempt = 0; attempt < 3; attempt++) {
                try {
                  blob = await request<Blob>(
                    `/map/tiles/${coords.z}/${coords.x}/${coords.y}`,
                    "GET",
                    undefined,
                    { responseType: "blob", signal: record.controller.signal },
                  );
                  break;
                } catch (cause) {
                  if (
                    !(cause instanceof ApiError) ||
                    cause.status !== 429 ||
                    !/busy|moment/i.test(cause.message) ||
                    attempt === 2
                  )
                    throw cause;
                  await new Promise(
                    /** Retry only a short busy response, never a spent quota. */ (
                      resolve,
                    ) => setTimeout(resolve, 1000),
                  );
                }
              }
              if (!active || record.controller.signal.aborted || !blob) return;
              record.url = URL.createObjectURL(blob);
              image.onload =
                /** Leaflet marks a tile loaded only when the image decoded. */ () =>
                  done(undefined, image);
              image.onerror =
                /** A corrupt image never becomes a silently blank successful tile. */ () =>
                  done(new Error("Couldn’t display this map tile"), image);
              image.src = record.url;
            } catch (cause) {
              if (active && !record.controller.signal.aborted) {
                stopped = true;
                setError(validationMessage(cause));
                done(new Error("Map loading paused"), image);
              }
            }
            await new Promise(
              /** Keep each mounted map's outgoing pace modest. */ (resolve) =>
                setTimeout(resolve, 250),
            );
          });
          return image;
        }
      }
      const tiles = new AuthenticatedTiles({
        tileSize: 256,
        maxZoom: 18,
        keepBuffer: 0,
        noWrap: true,
        updateWhenIdle: true,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · Powered by <a href="https://www.geoapify.com/">Geoapify</a>',
      });
      tiles.on(
        "tileunload",
        /** Release only the unloaded element's resources. */ (
          event: TileEvent,
        ) => release(event.tile as HTMLImageElement),
      );
      tiles.addTo(map);
      setHandle({ map, group: L.layerGroup().addTo(map), api: L });
    }
    void initialize().catch(
      /** Loading errors preserve list/manual navigation. */ (cause) => {
        if (active) setError(validationMessage(cause));
      },
    );
    return () => {
      active = false;
      for (const image of images.keys()) release(image);
      map?.remove();
    };
  }, [container, request, revision]);

  /** Draw only app-owned markers and use text nodes to prevent customer-label HTML injection. */
  useEffect(() => {
    if (!handle) return;
    const { map, group, api: L } = handle;
    group.clearLayers();
    const points: [number, number][] = [];
    for (const marker of markers) {
      if (!hasCoordinates(marker)) continue;
      const point: [number, number] = [marker.latitude, marker.longitude];
      points.push(point);
      const label = document.createElement("span");
      label.textContent = marker.label;
      const node = L.circleMarker(point, {
        radius: marker.key === selectedKey ? 11 : 8,
        color: "#ffffff",
        weight: 3,
        fillColor: marker.key === selectedKey ? "#006b54" : "#657e73",
        fillOpacity: 1,
      })
        .bindTooltip(label)
        .addTo(group);
      if (onSelect)
        node.on(
          "click",
          /** Manual marker choice never triggers a billable road recalculation. */ () =>
            onSelect(marker.key),
        );
    }
    if (origin && hasCoordinates(origin)) {
      const point: [number, number] = [origin.latitude, origin.longitude];
      points.push(point);
      L.circleMarker(point, {
        radius: 7,
        color: "#ffffff",
        weight: 3,
        fillColor: "#2779bd",
        fillOpacity: 1,
      })
        .bindTooltip("Your current GPS reading")
        .addTo(group);
    }
    if (points.length)
      map.fitBounds(L.latLngBounds(points), {
        padding: [35, 35],
        maxZoom: compact ? 16 : 15,
        animate: false,
      });
    else map.setView([12.8797, 121.774], 5);
    map.invalidateSize();
  }, [handle, markers, origin, selectedKey, onSelect, compact]);

  /** Pin correction is offered only by the delivery review; viewing a map never writes coordinates. */
  useEffect(() => {
    if (!handle || !onPick) return;
    const click =
      /** Keep correction in local dialog state until explicit confirmation. */ (event: {
        latlng: { lat: number; lng: number };
      }) => onPick({ latitude: event.latlng.lat, longitude: event.latlng.lng });
    handle.map.on("click", click);
    return () => {
      handle.map.off("click", click);
    };
  }, [handle, onPick]);

  return (
    <div className="geo-map-wrap">
      <div
        ref={setContainer}
        role="region"
        aria-label={
          onPick ? "Address location review map" : "Customer locations map"
        }
        style={{
          height: compact ? 280 : 430,
          width: "100%",
          position: "relative",
          isolation: "isolate",
          background: "#e9efe9",
          borderRadius: 14,
        }}
      />
      {error && (
        <div className="notice notice-amber" role="alert">
          <p>
            {error} Manual delivery and external navigation remain available.
          </p>
          <Button
            variant="secondary"
            onClick={
              /** An explicit retry, never background polling. */ () =>
                setRevision((value) => value + 1)
            }
          >
            Retry map
          </Button>
        </div>
      )}
      {onPick && (
        <p className="small-muted">
          Tap the map or edit coordinates to correct the reviewed pin. The saved
          address changes only after confirmation.
        </p>
      )}
    </div>
  );
}
