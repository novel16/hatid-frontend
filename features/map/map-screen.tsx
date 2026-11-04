"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Check,
  Clock,
  CornerDownRight,
  List,
  MapPin,
  MapPinOff,
  Navigation,
  Route,
} from "lucide-react";
import { usePrototypeState } from "@/lib/prototype/store";
import {
  chosenStop,
  hasRoadEstimate,
  eligible,
  money,
  recommendedStops,
  selectNextStop,
} from "@/lib/prototype/domain";
import { useActions } from "@/components/providers";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  LinkButton,
  PageHeading,
} from "@/components/ui";
import { ChooseStopDialog } from "@/components/delivery-ui";
import { CityMap } from "@/components/city-map";
import { AccountMap } from "./account-map";

/** Keep account mapping and labelled sample navigation in separate components/state. */
export function MapScreen() {
  const { session } = useActions();
  const anchor = useSearchParams().get("parcel") ?? "";
  return session ? (
    <AccountMap
      key={`${session.access_token}:${session.user.vehicle}:${anchor}`}
    />
  ) : (
    <DemoMapScreen />
  );
}

/** Preserve the existing clickable sample route without using account/provider data. */
function DemoMapScreen() {
  const state = usePrototypeState();
  const { commit } = useActions();
  const stop = chosenStop(state);
  const manualChosen = !!stop && state.manualNextStop === stop.key;
  const candidates = recommendedStops(state);
  const [picker, setPicker] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [turn, setTurn] = useState(0);
  const turns = [
    "Head east on Mabini Street",
    "Turn right towards Rizal Street",
    "Your customer is on the right",
  ];
  const mapStops =
    stop && !candidates.some((item) => item.key === stop.key)
      ? [stop, ...candidates.slice(0, 4)]
      : candidates;
  const selectedParcels =
    stop?.parcels.filter((parcel) => eligible(parcel)) ?? [];
  return (
    <>
      <PageHeading
        eyebrow="YOUR ROUTE, YOUR CALL"
        title="A calmer way to your next stop."
        description="A fast estimate among up to five nearby stops. You can always choose manually."
      >
        <Button variant="secondary" onClick={() => setPicker(true)}>
          <List size={16} />
          Choose customer
        </Button>
        <LinkButton href="/deliveries" variant="secondary">
          Delivery list
          <ArrowRight size={15} />
        </LinkButton>
      </PageHeading>
      <div className="map-layout">
        <div className="map-main">
          <CityMap
            stops={mapStops}
            selectedKey={stop?.key}
            onSelect={(entry) => {
              commit((current) => selectNextStop(current, entry.key));
              setNavigating(false);
              setTurn(0);
            }}
          />
          <div className="map-bottom-caption">
            <Badge tone="green">
              <MapPin size={13} />
              Your sample service area
            </Badge>
            <span>Illustrative map and road estimates · no live traffic</span>
          </div>
          {stop?.address.latitude === null && (
            <div className="map-empty-overlay">
              <MapPinOff size={32} />
              <h3>This address doesn’t have a pin yet.</h3>
              <p>
                You can find the customer manually and complete the delivery.
              </p>
              <LinkButton href={`/deliveries/${stop.parcels[0].id}`}>
                Open manual delivery
                <ArrowRight size={16} />
              </LinkButton>
            </div>
          )}
        </div>
        <aside className="route-aside">
          <Card
            title={
              manualChosen ? "Your chosen next stop" : "Suggested next stop"
            }
            action={
              <Badge tone={manualChosen ? "blue" : "green"}>
                {manualChosen ? "Manual" : "Recommended"}
              </Badge>
            }
          >
            {stop ? (
              <div className="card-body form-stack">
                <div className="route-person">
                  <Avatar
                    name={stop.customer.name}
                    color={stop.customer.color}
                  />
                  <div>
                    <h3>{stop.customer.name}</h3>
                    <p>{selectedParcels.length} parcel(s) ready</p>
                  </div>
                </div>
                <p className="route-address">
                  <MapPin size={17} />
                  {stop.address.text}
                </p>
                <div className="route-stats">
                  <div>
                    <Clock size={17} />
                    <strong>
                      {hasRoadEstimate(stop.address) && !state.offline
                        ? `${stop.address.minutes} min`
                        : "Manual"}
                    </strong>
                    <small>estimated travel</small>
                  </div>
                  <div>
                    <Route size={17} />
                    <strong>
                      {hasRoadEstimate(stop.address) && !state.offline
                        ? `${stop.address.distanceKm.toFixed(1)} km`
                        : "No route"}
                    </strong>
                    <small>sample road distance</small>
                  </div>
                </div>
                <div className="route-collect">
                  <span>Customer total to collect</span>
                  <strong>
                    {money(
                      selectedParcels.reduce(
                        (sum, parcel) => sum + parcel.pricing.total,
                        0,
                      ),
                    )}
                  </strong>
                </div>
                {navigating ? (
                  <div className="turn-preview">
                    <Badge tone="green">Navigation preview</Badge>
                    <div>
                      <CornerDownRight size={29} />
                      <strong>{turns[turn]}</strong>
                    </div>
                    <p>
                      Step {turn + 1} of {turns.length} · illustrative
                      directions
                    </p>
                    {turn < turns.length - 1 ? (
                      <Button
                        className="button-full"
                        onClick={() => setTurn((value) => value + 1)}
                      >
                        Next instruction
                        <ArrowRight size={16} />
                      </Button>
                    ) : (
                      <LinkButton
                        href={`/deliveries/${stop.parcels[0].id}`}
                        className="button-full"
                      >
                        <Check size={16} />
                        Arrived — open handover
                      </LinkButton>
                    )}
                  </div>
                ) : (
                  <>
                    <Button
                      className="button-full"
                      disabled={!hasRoadEstimate(stop.address) || state.offline}
                      onClick={() => {
                        setNavigating(true);
                        setTurn(0);
                      }}
                    >
                      <Navigation size={17} />
                      Preview navigation
                    </Button>
                    <LinkButton
                      href={`/deliveries/${stop.parcels[0].id}`}
                      variant="secondary"
                      className="button-full"
                    >
                      Open delivery
                      <ArrowRight size={16} />
                    </LinkButton>
                  </>
                )}
                <button className="text-link" onClick={() => setPicker(true)}>
                  Choose a different customer
                  <ArrowRight size={14} />
                </button>
              </div>
            ) : (
              <EmptyState
                title="Choose your next stop"
                action={
                  <Button onClick={() => setPicker(true)}>
                    Browse customers
                  </Button>
                }
              >
                Manual delivery remains available when you’re offline or a
                customer has no pin.
              </EmptyState>
            )}
          </Card>
          <div className="route-candidate-card">
            <div>
              <h3>Nearby stops</h3>
              <Badge tone="gray">{candidates.length} / 5 compared</Badge>
            </div>
            {candidates.map((entry, index) => (
              <button
                key={entry.key}
                className={entry.key === stop?.key ? "candidate-active" : ""}
                onClick={() => {
                  commit((current) => selectNextStop(current, entry.key));
                  setNavigating(false);
                  setTurn(0);
                }}
              >
                <span>{index + 1}</span>
                <div>
                  <strong>{entry.customer.name}</strong>
                  <small>
                    {entry.address.distanceKm.toFixed(1)} km ·{" "}
                    {entry.parcels.filter((parcel) => eligible(parcel)).length}{" "}
                    parcel(s)
                  </small>
                </div>
                <b>{entry.address.minutes} min</b>
              </button>
            ))}
            {!candidates.length && (
              <p className="small-muted">
                No fresh road estimates available. Choose a customer manually.
              </p>
            )}
          </div>
        </aside>
      </div>
      <ChooseStopDialog open={picker} onClose={() => setPicker(false)} />
    </>
  );
}
