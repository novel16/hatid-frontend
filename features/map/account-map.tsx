"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Clock,
  List,
  LocateFixed,
  MapPin,
  Navigation,
  Route,
} from "lucide-react";
import { useActions } from "@/components/providers";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  LinkButton,
  Modal,
  PageHeading,
} from "@/components/ui";
import { GeoMap, type GeoMarker } from "@/components/geo-map";
import { AccountDeliveriesScreen } from "@/features/deliveries/account-deliveries";
import {
  validationMessage,
  VEHICLE_LABELS,
  type ApiDelivery,
  type MapCandidate,
  type MapOverview,
} from "@/lib/api";
import {
  hasCoordinates,
  isReadyParcel,
  navigationUrl,
  readCurrentLocation,
  resolveMapSelection,
  type GpsReading,
} from "@/lib/maps";
import { money } from "@/lib/prototype/domain";

/** Own current GPS, bounded real road estimates and manual override without writing account data to demo storage. */
export function AccountMap() {
  const { request, session, notify } = useActions();
  const params = useSearchParams();
  const initialParcel = params.get("parcel");
  const [overview, setOverview] = useState<MapOverview | null>(null);
  const [selected, setSelected] = useState<ApiDelivery | null>(null);
  const [manual, setManual] = useState(false);
  const [origin, setOrigin] = useState<GpsReading | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [picker, setPicker] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const version = useRef(0);
  const vehicle = overview?.vehicle ?? session?.user.vehicle ?? null;

  /** Read free metadata and an optional owned delivery anchor; no automatic geolocation/provider request. */
  useEffect(() => {
    const current = ++version.current;
    let active = true;
    /** A route/account change cannot be overwritten by a delayed read. */
    async function load() {
      try {
        const { data } = await request<{ data: MapOverview }>("/map");
        if (!active) return;
        setOverview(data);
        if (
          current === version.current &&
          initialParcel &&
          /^\d+$/.test(initialParcel)
        ) {
          const result = await request<{ data: ApiDelivery }>(
            `/deliveries/${encodeURIComponent(initialParcel)}`,
          );
          if (!active || current !== version.current) return;
          setSelected(result.data);
          setManual(true);
        }
      } catch (cause) {
        if (active && current === version.current)
          setError(validationMessage(cause));
      }
    }
    void load();
    return () => {
      active = false;
      version.current += 1;
    };
  }, [request, initialParcel]);

  /** Manual override uses the same server-paginated ready-work list and never triggers a route request. */
  function choose(stop: ApiDelivery) {
    version.current += 1;
    setBusy(false);
    setSelected(stop);
    setManual(true);
    setPicker(false);
  }

  /** An explicit comparison takes a fresh temporary rider origin, then uses server-owned/profiled targets. */
  async function compare() {
    if (busy || !vehicle || !overview?.configured) return;
    const current = ++version.current;
    setBusy(true);
    setError("");
    try {
      const reading = await readCurrentLocation();
      if (current !== version.current) return;
      setOrigin(reading);
      const { data } = await request<{ data: MapOverview }>(
        "/map/recommendations",
        "POST",
        reading,
      );
      if (current !== version.current) return;
      const choice = await resolveMapSelection(
        data.candidates,
        manual ? selected : null,
        /** Refresh only the manual stop, without another provider comparison. */
        async (parcelId) =>
          (await request<{ data: ApiDelivery }>(`/deliveries/${parcelId}`))
            .data,
        /** Late reads cannot change a newer choice or route view. */
        () => current === version.current,
      );
      if (!choice || current !== version.current) return;
      setOverview(data);
      setSelected(choice.stop);
      setManual(choice.manual);
      if (choice.closedManual)
        notify(
          "That manually selected stop is no longer ready. Review the current suggestions.",
        );
      if (choice.unverifiedManual)
        notify(
          "Couldn’t refresh your chosen stop. Your manual choice is retained; open its delivery to check.",
          true,
        );
    } catch (cause) {
      if (current === version.current) {
        setError(validationMessage(cause));
        setOverview(
          /** Old figures must not look like a fresh successful comparison. */ (
            value,
          ) =>
            value
              ? {
                  ...value,
                  candidates: [],
                  compared_count: 0,
                  estimated_at: null,
                }
              : value,
        );
      }
    } finally {
      if (current === version.current) setBusy(false);
    }
  }

  /** Open a recommended marker through the same explicit manual selection flow. */
  function selectMarker(key: string) {
    const stop = overview?.candidates.find(
      /** Keys identify one owned customer/address, independent of intake week. */ (
        candidate,
      ) => candidate.key === key,
    );
    if (stop) choose(stop);
  }

  const candidates = overview?.candidates ?? [];
  const estimate: MapCandidate | undefined = candidates.find(
    /** A selected stop only receives its own compared estimate. */ (
      candidate,
    ) => candidate.key === selected?.key,
  );
  const readyParcels =
    selected?.parcels.filter(
      /** Never include closed/future-held/failed parcels in a ready total. */ (
        parcel,
      ) => isReadyParcel(parcel),
    ) ?? [];
  const navigation =
    selected && vehicle ? navigationUrl(selected.address, vehicle) : null;
  const markers: GeoMarker[] = candidates
    .filter(
      /** Only actual saved pins become map markers. */ (candidate) =>
        hasCoordinates(candidate.address),
    )
    .map(
      /** Marker labels are rendered as text by the reusable map. */ (
        candidate,
      ) => ({
        key: candidate.key,
        label: candidate.customer.name,
        latitude: candidate.address.latitude!,
        longitude: candidate.address.longitude!,
      }),
    );
  if (
    selected &&
    hasCoordinates(selected.address) &&
    !markers.some((marker) => marker.key === selected.key)
  ) {
    markers.push({
      key: selected.key,
      label: selected.customer.name,
      latitude: selected.address.latitude,
      longitude: selected.address.longitude,
    });
  }

  return (
    <>
      <PageHeading
        eyebrow="YOUR ROUTE, YOUR CALL"
        title="One good next stop."
        description="Compare up to five nearby pinned stops by estimated travel time, with road distance as the tie-break. You can always choose manually."
      >
        <Button
          variant="secondary"
          onClick={
            /** Manual delivery works even without a pin, GPS permission or provider credits. */ () =>
              setPicker(true)
          }
        >
          <List size={17} />
          Choose customer
        </Button>
        <LinkButton href="/deliveries" variant="secondary">
          Delivery list
          <ArrowRight size={16} />
        </LinkButton>
      </PageHeading>
      {!vehicle && (
        <div className="notice notice-amber">
          <p>
            Choose your primary vehicle before requesting road recommendations.
          </p>
          <LinkButton href="/settings" variant="secondary">
            Complete rider profile
          </LinkButton>
        </div>
      )}
      {overview && !overview.configured && (
        <div className="notice notice-amber">
          <p>
            Maps are not configured yet. Choose a customer and continue
            deliveries manually.
          </p>
        </div>
      )}
      {error && (
        <div role="alert" className="notice notice-amber">
          <p>{error} Your delivery records are unaffected.</p>
        </div>
      )}
      <div className="map-account-tools">
        <Button
          disabled={busy || !vehicle || !overview?.configured}
          onClick={compare}
        >
          <LocateFixed size={17} />
          {busy
            ? "Checking GPS & nearby roads…"
            : "Use current GPS & compare stops"}
        </Button>
        <Badge tone="green">
          {vehicle ? VEHICLE_LABELS[vehicle] : "Vehicle needed"}
        </Badge>
        {/* {overview && (
          <span className="small-muted">
            Shared free allowance: {overview.quota.used.toLocaleString()} /{" "}
            {overview.quota.limit.toLocaleString()} credits accounted
          </span>
        )} */}
      </div>
      <div className="map-layout">
        <div className="map-main">
          {mapOpen ? (
            <GeoMap
              markers={markers}
              origin={origin}
              selectedKey={selected?.key}
              onSelect={selectMarker}
            />
          ) : (
            <Card>
              <EmptyState
                title="Open the map when you need it"
                action={
                  <Button
                    disabled={!overview?.configured}
                    onClick={
                      /** Lazy map loading avoids spending tile credits just by visiting this page. */ () =>
                        setMapOpen(true)
                    }
                  >
                    <MapPin size={17} />
                    Open map
                  </Button>
                }
              >
                Saved customer pins and your temporary GPS reading appear here.
                Navigation opens in Google Maps.
              </EmptyState>
            </Card>
          )}
          <div className="map-bottom-caption">
            <Badge tone="gray">
              Philippines ·{" "}
              {vehicle ? VEHICLE_LABELS[vehicle] : "Choose vehicle"}
            </Badge>
            <span>
              Road estimates · no live traffic or island-route guarantee
            </span>
          </div>
          {origin && (
            <p className="small-muted">
              Rider reading: ±{Math.round(origin.accuracy)} m ·{" "}
              {new Date(origin.captured_at).toLocaleTimeString()}. This does not
              save a customer pin.
            </p>
          )}
          {origin && origin.accuracy > 100 && (
            <p className="notice notice-amber">
              Your current location has low accuracy. Retry outdoors before
              relying on these estimates.
            </p>
          )}
        </div>
        <aside className="route-aside">
          <Card
            title={manual ? "Your chosen next stop" : "Suggested next stop"}
            action={
              <Badge tone={manual ? "blue" : "green"}>
                {manual ? "Manual choice" : "Recommended"}
              </Badge>
            }
          >
            {selected ? (
              <div className="card-body form-stack">
                <div className="route-person">
                  <Avatar name={selected.customer.name} />
                  <div>
                    <h3>{selected.customer.name}</h3>
                    <p>{readyParcels.length} parcel(s) ready</p>
                  </div>
                </div>
                <p className="route-address">
                  <MapPin size={17} />
                  {selected.address.label} ·{" "}
                  {selected.address.text ?? "Address not provided"}
                </p>
                <div className="route-stats">
                  <div>
                    <Clock size={17} />
                    <strong>
                      {estimate?.duration_seconds != null
                        ? `${Math.ceil(estimate.duration_seconds / 60)} min`
                        : "Manual"}
                    </strong>
                    <small>estimated travel</small>
                  </div>
                  <div>
                    <Route size={17} />
                    <strong>
                      {estimate?.distance_meters != null
                        ? `${(estimate.distance_meters / 1000).toFixed(1)} km`
                        : "No road estimate"}
                    </strong>
                    <small>returned road distance</small>
                  </div>
                </div>
                <div className="route-collect">
                  <span>Ready customer total</span>
                  <strong>
                    {money(
                      readyParcels.reduce(
                        /** Sum only ready parcels' saved customer totals. */ (
                          sum,
                          parcel,
                        ) => sum + parcel.pricing.total,
                        0,
                      ),
                    )}
                  </strong>
                </div>
                {!hasCoordinates(selected.address) && (
                  <p className="notice notice-amber">
                    No saved pin yet. Deliver manually; successful handover
                    offers optional location review.
                  </p>
                )}
                {navigation && (
                  <a
                    className="button button-primary button-full"
                    href={navigation}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Navigation size={17} />
                    Navigate in Google Maps
                  </a>
                )}
                <LinkButton
                  href={`/deliveries/${selected.parcels[0].id}`}
                  variant="secondary"
                  className="button-full"
                >
                  Open delivery
                  <ArrowRight size={16} />
                </LinkButton>
                {manual &&
                  candidates.some(
                    (candidate) => candidate.duration_seconds !== null,
                  ) && (
                    <Button
                      variant="ghost"
                      onClick={
                        /** Return to the current recommendation without a new paid/provider request. */ () => {
                          setManual(false);
                          setSelected(
                            candidates.find(
                              (candidate) =>
                                candidate.duration_seconds !== null,
                            ) ?? null,
                          );
                        }
                      }
                    >
                      Use recommended stop
                    </Button>
                  )}
              </div>
            ) : (
              <EmptyState
                title="Choose your next stop"
                action={
                  <Button
                    variant="secondary"
                    onClick={
                      /** The full ready-work picker includes unknown locations. */ () =>
                        setPicker(true)
                    }
                  >
                    Browse ready customers
                  </Button>
                }
              >
                Use current GPS for a road comparison, or choose any ready
                customer manually.
              </EmptyState>
            )}
          </Card>
          <div className="route-candidate-card">
            <div>
              <h3>Compared nearby stops</h3>
              <Badge>{overview?.compared_count ?? 0} / 5</Badge>
            </div>
            {candidates.map(
              /** Null routes remain selectable manually and never display invented zero values. */ (
                candidate,
                index,
              ) => (
                <button
                  key={candidate.key}
                  className={
                    selected?.key === candidate.key ? "candidate-active" : ""
                  }
                  onClick={() => choose(candidate)}
                >
                  <span>{index + 1}</span>
                  <div>
                    <strong>{candidate.customer.name}</strong>
                    <small>
                      {candidate.distance_meters === null
                        ? "No road route returned"
                        : `${(candidate.distance_meters / 1000).toFixed(1)} km`}{" "}
                      · {candidate.parcels.length} parcel(s)
                    </small>
                  </div>
                  <b>
                    {candidate.duration_seconds === null
                      ? "Manual"
                      : `${Math.ceil(candidate.duration_seconds / 60)} min`}
                  </b>
                </button>
              ),
            )}
            {!candidates.length && (
              <p className="small-muted">
                No current comparison. Unknown pins, failed work and future
                holds are not automatic candidates.
              </p>
            )}
            {overview?.estimated_at && (
              <p className="small-muted">
                Compared {new Date(overview.estimated_at).toLocaleTimeString()}{" "}
                · fastest estimate among this shortlist.
              </p>
            )}
          </div>
        </aside>
      </div>
      {/* <p className="small-muted batch-note">
        Free usage is shared by all riders. When the allowance or provider is
        unavailable, manual delivery and external navigation remain available.
      </p> */}
      <Modal
        open={picker}
        onClose={
          /** Closing preserves the current manual/recommended choice. */ () =>
            setPicker(false)
        }
        wide
        title="Choose your next customer"
        description="Ready parcels across intake weeks, including customers without a saved location."
      >
        {picker && (
          <div className="dialog-body">
            <AccountDeliveriesScreen embedded onChoose={choose} />
          </div>
        )}
      </Modal>
    </>
  );
}
