"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronRight,
  Clock,
  MapPin,
  MapPinOff,
  Navigation,
  Route,
  Search,
} from "lucide-react";
import {
  chosenStop,
  eligible,
  getStops,
  hasRoadEstimate,
  money,
  recommendedStops,
} from "@/lib/prototype/domain";
import { usePrototypeState } from "@/lib/prototype/store";
import type { Stop } from "@/lib/prototype/types";
import { useActions } from "./providers";
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  LinkButton,
  Modal,
  StatusBadge,
} from "./ui";

export function StopTable({ stops }: { stops: Stop[] }) {
  if (!stops.length)
    return (
      <EmptyState
        title="Nothing here just yet"
        action={
          <LinkButton href="/parcels/new">
            Add your first parcel
            <ArrowRight size={16} />
          </LinkButton>
        }
      >
        Add a parcel or try a different filter.
      </EmptyState>
    );
  return (
    <div className="table-scroll">
      <table className="data-table stop-table">
        <thead>
          <tr>
            <th>Customer</th>
            <th>Parcels</th>
            <th>Payment</th>
            <th>Parcel total</th>
            <th>Status</th>
            <th>
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {stops.map((stop) => {
            const methods = [
              ...new Set(
                stop.parcels.map(
                  (parcel) => parcel.receipt?.method ?? parcel.expectedMethod,
                ),
              ),
            ];
            const amount = stop.parcels.reduce(
              (sum, parcel) => sum + parcel.pricing.total,
              0,
            );
            return (
              <tr key={stop.key}>
                <td>
                  <Link
                    className="customer-link"
                    href={`/deliveries/${stop.parcels[0].id}`}
                  >
                    <Avatar
                      name={stop.customer.name}
                      color={stop.customer.color}
                    />
                    <span>
                      <strong>{stop.customer.name}</strong>
                      <small>
                        {stop.address.latitude === null ? (
                          <MapPinOff size={11} />
                        ) : (
                          <MapPin size={11} />
                        )}
                        {stop.address.latitude === null
                          ? "No saved location"
                          : stop.address.text.split(",").at(-1)?.trim()}
                      </small>
                      <span className="mobile-status">
                        <StatusBadge status={stop.status} />
                      </span>
                    </span>
                  </Link>
                </td>
                <td>
                  <span className="parcel-count">
                    {stop.parcels.length} parcel
                    {stop.parcels.length === 1 ? "" : "s"}
                  </span>
                </td>
                <td>
                  <Badge
                    tone={
                      methods.length === 1 && methods[0] === "gcash"
                        ? "blue"
                        : "gray"
                    }
                  >
                    {methods.length > 1
                      ? "Mixed"
                      : methods[0] === "gcash"
                        ? "GCash"
                        : "COD"}
                  </Badge>
                </td>
                <td className="money-cell">{money(amount)}</td>
                <td>
                  <StatusBadge status={stop.status} />
                </td>
                <td>
                  <Link
                    className="row-open"
                    href={`/deliveries/${stop.parcels[0].id}`}
                    aria-label={`View ${stop.customer.name}'s delivery`}
                  >
                    <ChevronRight size={18} />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ChooseStopDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const state = usePrototypeState();
  const { commit } = useActions();
  const [tab, setTab] = useState("suggested");
  const [search, setSearch] = useState("");
  const suggested = recommendedStops(state);
  const all = getStops(state).filter((stop) =>
    stop.parcels.some((parcel) => eligible(parcel)),
  );
  const showingAll = tab === "all" || state.offline || !suggested.length;
  const choices = (showingAll ? all : suggested).filter((stop) =>
    `${stop.customer.name} ${stop.address.text}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Where do you want to go next?"
      description="Compare up to 5 nearby stops, or choose any eligible customer."
    >
      <div className="dialog-body">
        <div className="segmented">
          <button
            className={!showingAll ? "selected" : ""}
            onClick={() => setTab("suggested")}
            disabled={state.offline || !suggested.length}
          >
            Suggested <span>{suggested.length}</span>
          </button>
          <button
            className={showingAll ? "selected" : ""}
            onClick={() => setTab("all")}
          >
            Browse all <span>{all.length}</span>
          </button>
        </div>
        <div className="input-with-icon">
          <Search size={16} />
          <input
            aria-label="Find a next customer"
            placeholder="Find a customer..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="stop-choices">
          {choices.map((stop, index) => (
            <button
              className={`stop-choice ${state.manualNextStop === stop.key ? "stop-choice-active" : ""}`}
              key={stop.key}
              onClick={() => {
                commit(
                  (current) => ({ ...current, manualNextStop: stop.key }),
                  `${stop.customer.name} is your next stop.`,
                );
                onClose();
              }}
            >
              <Avatar name={stop.customer.name} color={stop.customer.color} />
              <span className="stop-choice-main">
                <strong>
                  {stop.customer.name}
                  {!showingAll && index === 0 && (
                    <Badge tone="green">Fastest estimate</Badge>
                  )}
                </strong>
                <small>{stop.address.text}</small>
                <small>
                  {stop.parcels.filter((parcel) => eligible(parcel)).length}{" "}
                  parcel(s) ready
                </small>
              </span>
              <span className="stop-estimate">
                {hasRoadEstimate(stop.address) && !state.offline ? (
                  <>
                    <b>{stop.address.minutes} min</b>
                    <small>{stop.address.distanceKm.toFixed(1)} km</small>
                  </>
                ) : (
                  <Badge tone="amber">Manual</Badge>
                )}
              </span>
              {state.manualNextStop === stop.key ? (
                <Check size={18} />
              ) : (
                <ChevronRight size={17} />
              )}
            </button>
          ))}
        </div>
        {choices.length === 0 && (
          <EmptyState title="No matching stops">
            Try another name or add a new parcel.
          </EmptyState>
        )}
        <div className="notice notice-muted">
          <Route size={17} />
          <p>
            Road estimates are sample values in this prototype. You’re always
            free to choose another stop.
          </p>
        </div>
      </div>
      <footer className="dialog-footer">
        <Button variant="secondary" onClick={onClose}>
          Keep current stop
        </Button>
        {suggested.length > 0 && (
          <Button
            onClick={() => {
              commit(
                (current) => ({ ...current, manualNextStop: null }),
                "Using the fastest suggested stop.",
              );
              onClose();
            }}
          >
            Use recommendation
            <ArrowRight size={16} />
          </Button>
        )}
      </footer>
    </Modal>
  );
}

export function NextStopCard() {
  const state = usePrototypeState();
  const [open, setOpen] = useState(false);
  const stop = chosenStop(state);
  const ready = stop?.parcels.filter((parcel) => eligible(parcel)) ?? [];
  const manual =
    !!stop &&
    (state.manualNextStop === stop.key ||
      !hasRoadEstimate(stop.address) ||
      state.offline);
  return (
    <>
      <section className="next-stop-card">
        <svg
          className="route-decoration"
          viewBox="0 0 340 240"
          aria-hidden="true"
        >
          <path
            d="M20 220V110Q20 85 50 85H180Q210 85 210 55V0M100 240V160Q100 135 130 135H300M0 185H340M155 0V240M270 0V240"
            fill="none"
            stroke="currentColor"
            strokeWidth="14"
          />
          <path
            d="M85 205V155Q85 120 120 120H220Q245 120 245 95V45"
            stroke="#a9e5c1"
            strokeWidth="3"
            strokeDasharray="6 7"
            fill="none"
          />
          <circle cx="245" cy="45" r="9" fill="#a9e5c1" />
        </svg>
        <div className="next-stop-eyebrow">
          <span>
            <i />
            {manual ? "YOUR CHOSEN NEXT STOP" : "YOUR NEXT STOP"}
          </span>
          <Badge tone="green">{manual ? "Manual choice" : "Recommended"}</Badge>
        </div>
        {stop ? (
          <>
            <div className="next-stop-main">
              <div className="next-pin">
                <MapPin size={24} />
              </div>
              <div>
                <h2>{stop.customer.name}</h2>
                <p>{stop.address.text}</p>
                <div className="next-stop-meta">
                  <span>
                    {ready.length} parcel{ready.length === 1 ? "" : "s"}
                  </span>
                  <i />
                  <span>
                    {money(
                      ready.reduce(
                        (sum, parcel) => sum + parcel.pricing.total,
                        0,
                      ),
                    )}{" "}
                    to collect
                  </span>
                </div>
              </div>
            </div>
            <div className="next-stop-bottom">
              <div className="next-travel">
                {!hasRoadEstimate(stop.address) || state.offline ? (
                  <>
                    <MapPinOff size={17} />
                    <strong>Deliver manually</strong>
                  </>
                ) : (
                  <>
                    <Clock size={17} />
                    <strong>{stop.address.minutes} min</strong>
                    <span>·</span>
                    <strong>{stop.address.distanceKm.toFixed(1)} km</strong>
                    <small>demo estimate</small>
                  </>
                )}
              </div>
              <div className="next-stop-actions">
                <button onClick={() => setOpen(true)}>
                  Choose another
                  <ChevronRight size={15} />
                </button>
                <Link
                  href={
                    !hasRoadEstimate(stop.address) || state.offline
                      ? `/deliveries/${ready[0]?.id ?? stop.parcels[0].id}`
                      : "/map"
                  }
                >
                  {!hasRoadEstimate(stop.address) || state.offline
                    ? "Open delivery"
                    : "Start route"}
                  <Navigation size={16} />
                </Link>
              </div>
            </div>
          </>
        ) : (
          <div className="next-stop-empty">
            <h2>
              {state.offline
                ? "Keep delivering your way."
                : "Ready for your next delivery?"}
            </h2>
            <p>
              {state.offline
                ? "Choose a customer manually while you’re offline."
                : "Choose a stop manually or add a parcel to get started."}
            </p>
            <Button variant="secondary" onClick={() => setOpen(true)}>
              Choose a customer
              <ArrowRight size={16} />
            </Button>
          </div>
        )}
      </section>
      <ChooseStopDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
