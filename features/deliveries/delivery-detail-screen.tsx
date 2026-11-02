"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  ChevronRight,
  Clock,
  Copy,
  MapPin,
  MapPinOff,
  MessageSquare,
  Navigation,
  Package,
  Phone,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { usePrototypeHydrated, usePrototypeState } from "@/lib/prototype/store";
import {
  eligible,
  formatDate,
  getStops,
  money,
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
  Modal,
  PageHeading,
  StatusBadge,
} from "@/components/ui";
import { LocationDialog } from "@/features/customers/location-dialog";
import { CityMap } from "@/components/city-map";
import {
  DeliveredDialog,
  OutcomeDialog,
  type Outcome,
} from "./outcome-dialogs";

export function DeliveryDetailScreen({ parcelId }: { parcelId: string }) {
  const state = usePrototypeState();
  const hydrated = usePrototypeHydrated();
  const { commit, notify } = useActions();
  const parcel = state.parcels.find((item) => item.id === parcelId);
  const stop = parcel
    ? getStops(state, parcel.batchId).find(
        (item) =>
          item.customer.id === parcel.customerId &&
          item.address.id === parcel.addressId,
      )
    : undefined;
  const [selectedIds, setSelectedIds] = useState<string[]>(
    stop?.parcels
      .filter((item) => !["delivered", "returned"].includes(item.status))
      .map((item) => item.id) ?? [],
  );
  const [deliveredOpen, setDeliveredOpen] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [gpsOpen, setGpsOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  if ((!stop || !parcel) && !hydrated)
    return (
      <div
        className="page-skeleton"
        aria-busy="true"
        aria-label="Loading saved parcel"
      >
        <span />
        <span />
        <span />
      </div>
    );
  if (!stop || !parcel)
    return (
      <EmptyState
        title="This parcel isn’t in the demo workspace"
        action={<LinkButton href="/deliveries">Back to deliveries</LinkButton>}
      >
        Resetting the prototype removes parcels you created earlier.
      </EmptyState>
    );
  const selected = stop.parcels.filter(
    (item) =>
      selectedIds.includes(item.id) &&
      !["delivered", "returned"].includes(item.status),
  );
  const ready = selected.length > 0 && selected.every((item) => eligible(item));
  const amount = selected.reduce((sum, item) => sum + item.pricing.total, 0);
  const hasDelivered = stop.parcels.some((item) => item.status === "delivered");
  const allCompleted = stop.parcels.every((item) =>
    ["delivered", "returned"].includes(item.status),
  );
  const hasPin = stop.address.latitude !== null;

  return (
    <>
      <LinkButton href="/deliveries" variant="ghost" className="back-link">
        <ArrowLeft size={15} />
        All deliveries
      </LinkButton>
      <PageHeading
        eyebrow={`${state.batches.find((batch) => batch.id === parcel.batchId)?.name} / CUSTOMER STOP`}
        title="A clear handover starts here."
        description="Select parcels individually. Record exactly what happened at this address."
      >
        <StatusBadge status={stop.status} />
      </PageHeading>
      <div className="detail-layout">
        <div className="form-stack">
          <Card>
            <div className="customer-detail-header">
              <Avatar name={stop.customer.name} color={stop.customer.color} />
              <div>
                <h2>{stop.customer.name}</h2>
                <p>{stop.customer.phone}</p>
                <span>
                  <MapPin size={14} />
                  {stop.address.label} · {stop.address.text}
                </span>
              </div>
            </div>
            <div className="customer-actions">
              <Button variant="secondary" onClick={() => setContactOpen(true)}>
                <Phone size={15} />
                Contact customer
              </Button>
              <Button
                variant="secondary"
                disabled={!stop.parcels.some((item) => eligible(item))}
                onClick={() => {
                  commit(
                    (current) =>
                      selectNextStop(current, stop.key, parcel.batchId),
                    "Next stop selected manually.",
                  );
                }}
              >
                <Navigation size={15} />
                Make next stop
              </Button>
              {hasPin && stop.parcels.some((item) => eligible(item)) && (
                <Link
                  href="/map"
                  className="button button-ghost"
                  onClick={() =>
                    commit((current) =>
                      selectNextStop(current, stop.key, parcel.batchId),
                    )
                  }
                >
                  <MapPin size={15} />
                  View route
                </Link>
              )}
            </div>
            {!hasPin && (
              <div className="notice notice-amber address-missing-note">
                <MapPinOff size={19} />
                <div>
                  <strong>This address has no saved pin.</strong>
                  <p>
                    You can complete the delivery manually. Saving GPS
                    afterwards is optional.
                  </p>
                </div>
              </div>
            )}
          </Card>
          <Card
            title={`Parcels for ${stop.customer.name.split(" ")[0]}`}
            description="Choose only the parcels being handed over."
            action={<Badge tone="gray">{stop.parcels.length} parcel(s)</Badge>}
          >
            <div className="parcel-detail-list">
              {stop.parcels.map((item) => {
                const seller = state.sellers.find(
                  (entry) => entry.id === item.sellerId,
                );
                const completed = ["delivered", "returned"].includes(
                  item.status,
                );
                return (
                  <div
                    className={`parcel-detail-item ${completed ? "parcel-completed" : ""}`}
                    key={item.id}
                  >
                    <div className="parcel-item-top">
                      <label className="parcel-checkbox">
                        <input
                          type="checkbox"
                          aria-label={`Select ${item.reference}`}
                          disabled={completed}
                          checked={!completed && selectedIds.includes(item.id)}
                          onChange={(event) =>
                            setSelectedIds((current) =>
                              event.target.checked
                                ? [...new Set([...current, item.id])]
                                : current.filter((id) => id !== item.id),
                            )
                          }
                        />
                        <span>
                          {completed ? (
                            <Check size={13} />
                          ) : (
                            <Package size={16} />
                          )}
                        </span>
                      </label>
                      <div>
                        <strong>{item.reference}</strong>
                        <p>{item.description}</p>
                      </div>
                      <StatusBadge status={item.status} />
                    </div>
                    <div className="parcel-seller-line">
                      <span>
                        <i className={`seller-dot avatar-${seller?.color}`} />
                        {seller?.name}
                      </span>
                      <Badge
                        tone={item.expectedMethod === "gcash" ? "blue" : "gray"}
                      >
                        {item.receipt?.method === "gcash" ||
                        (!item.receipt && item.expectedMethod === "gcash")
                          ? "GCash"
                          : "COD cash"}
                      </Badge>
                      <small>Fee {item.pricing.mode}</small>
                    </div>
                    <div className="parcel-price-grid">
                      <div>
                        <span>Customer total</span>
                        <strong>{money(item.pricing.total)}</strong>
                      </div>
                      <div>
                        <span>Seller share</span>
                        <strong>{money(item.pricing.sellerShare)}</strong>
                      </div>
                      <div>
                        <span>Your fee</span>
                        <strong>{money(item.pricing.fee)}</strong>
                      </div>
                    </div>
                    {item.overrideReason && (
                      <p className="parcel-note">
                        Pricing override: {item.overrideReason}
                      </p>
                    )}
                    {item.note && <p className="parcel-note">{item.note}</p>}
                    {item.retryAt && item.status === "held" && (
                      <p className="retry-note">
                        <Clock size={13} />
                        Retry {formatDate(item.retryAt, true)}
                      </p>
                    )}
                    {item.receipt && (
                      <p className="receipt-confirmed">
                        <ShieldCheck size={14} />
                        Rider confirmed{" "}
                        {item.receipt.method === "gcash"
                          ? "external GCash"
                          : "cash"}{" "}
                        receipt · {formatDate(item.receipt.confirmedAt, true)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            {!allCompleted && (
              <div className="selection-footer">
                <span>
                  <strong>{selected.length}</strong> selected
                </span>
                <span>
                  Total to collect <strong>{money(amount)}</strong>
                </span>
              </div>
            )}
          </Card>
          <Card
            title="Delivery activity"
            description="Each attempt stays attached to its parcel."
          >
            <div className="timeline">
              {stop.parcels
                .flatMap((item) =>
                  item.attempts.map((attempt) => ({
                    ...attempt,
                    reference: item.reference,
                    key: `${item.id}-${attempt.id}`,
                  })),
                )
                .sort((a, b) => b.at.localeCompare(a.at))
                .map((attempt) => (
                  <div key={attempt.key}>
                    <span
                      className={`timeline-dot ${attempt.outcome === "delivered" ? "timeline-success" : ""}`}
                    />
                    <div>
                      <strong>
                        {attempt.reference} ·{" "}
                        {attempt.outcome === "pending"
                          ? "Ready for retry"
                          : attempt.outcome}
                      </strong>
                      <p>{attempt.note}</p>
                      <small>{formatDate(attempt.at, true)}</small>
                    </div>
                  </div>
                ))}
              {stop.parcels.every((item) => item.attempts.length === 0) && (
                <p className="small-muted">
                  No attempts yet. Your first outcome will appear here.
                </p>
              )}
            </div>
          </Card>
        </div>
        <aside className="detail-aside form-stack">
          <Card
            title={allCompleted ? "Handover complete" : "Ready for handover?"}
            description={
              allCompleted
                ? "Delivery and collection records are saved."
                : "Confirm the outcome after you visit the customer."
            }
          >
            <div className="card-body form-stack">
              {allCompleted ? (
                <div className="completed-summary">
                  <span>
                    <CheckCheck size={30} />
                  </span>
                  <h3>Every parcel accounted for.</h3>
                  <p>
                    Payment records and retained fees are reflected in your
                    collections.
                  </p>
                  <LinkButton href="/collections" variant="secondary">
                    View collections
                    <ChevronRight size={15} />
                  </LinkButton>
                </div>
              ) : (
                <>
                  <div className="handover-total">
                    <span>Selected customer total</span>
                    <strong>{money(amount)}</strong>
                    <small>
                      {selected.length} parcel(s) · fee already accounted for
                    </small>
                  </div>
                  <Button
                    className="button-full"
                    disabled={!ready}
                    onClick={() => setDeliveredOpen(true)}
                  >
                    <CheckCheck size={18} />
                    Mark delivered
                  </Button>
                  {selected.length > 0 && !ready && (
                    <p className="small-muted">
                      Resume failed or scheduled parcels before marking them
                      delivered.
                    </p>
                  )}
                  <div className="form-grid">
                    <Button
                      variant="secondary"
                      disabled={!selected.length}
                      onClick={() => setOutcome("held")}
                    >
                      <Clock size={15} />
                      Hold
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={!selected.length}
                      onClick={() => setOutcome("failed")}
                    >
                      Failed attempt
                    </Button>
                  </div>
                  <button
                    className="text-link"
                    disabled={!selected.length}
                    onClick={() => setOutcome("pending")}
                  >
                    <RotateCcw size={14} />
                    Resume delivery / retry
                  </button>
                  <button
                    className="text-link text-muted"
                    disabled={!selected.length}
                    onClick={() => setOutcome("returned")}
                  >
                    Return to seller
                    <ChevronRight size={13} />
                  </button>
                </>
              )}
              <div className="notice notice-muted">
                <ShieldCheck size={17} />
                <p>Only confirmed, paid deliveries add retained rider fees.</p>
              </div>
            </div>
          </Card>
          <Card
            title="Address location"
            action={
              <Badge tone={hasPin ? "green" : "amber"}>
                {hasPin ? "Pin saved" : "No pin"}
              </Badge>
            }
          >
            <CityMap compact />
            <div className="card-body">
              <p className="small-muted">{stop.address.text}</p>
              {hasDelivered && (
                <Button
                  variant="secondary"
                  className="button-full"
                  onClick={() => setGpsOpen(true)}
                >
                  <MapPin size={15} />
                  Review address pin
                </Button>
              )}
            </div>
          </Card>
          {hasDelivered && (
            <button
              className="subtle-action"
              onClick={() => setCorrectionOpen(true)}
            >
              Need a correction? Record a review request
              <ChevronRight size={13} />
            </button>
          )}
        </aside>
      </div>
      {deliveredOpen && (
        <DeliveredDialog
          parcels={selected}
          onClose={() => setDeliveredOpen(false)}
          onSaved={() => setGpsOpen(true)}
        />
      )}
      {outcome && (
        <OutcomeDialog
          parcels={selected}
          outcome={outcome}
          onClose={() => setOutcome(null)}
        />
      )}
      {gpsOpen && (
        <LocationDialog
          customer={stop.customer}
          address={stop.address}
          afterDelivery={hasDelivered}
          onClose={() => setGpsOpen(false)}
        />
      )}
      <Modal
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        title={`Contact ${stop.customer.name.split(" ")[0]}`}
        description="Contact preview · this prototype does not place calls or send messages."
      >
        <div className="dialog-body contact-preview">
          <Avatar name={stop.customer.name} color={stop.customer.color} />
          <h3>{stop.customer.name}</h3>
          <p>{stop.customer.phone}</p>
          <p className="contact-message">
            Hi {stop.customer.name.split(" ")[0]}! Your rider is on the way with{" "}
            {
              stop.parcels.filter(
                (item) => !["delivered", "returned"].includes(item.status),
              ).length
            }{" "}
            parcel(s). Are you available to receive them?
          </p>
          <Button
            variant="secondary"
            onClick={() =>
              navigator.clipboard
                .writeText(stop.customer.phone)
                .then(() => notify("Number copied."))
                .catch(() =>
                  notify("Copy is not available in this browser.", true),
                )
            }
          >
            <Copy size={15} />
            Copy number
          </Button>
          <Button
            onClick={() => {
              notify("Message preview ready. No message was sent.");
            }}
          >
            <MessageSquare size={15} />
            Preview message
          </Button>
        </div>
      </Modal>
      <Modal
        open={correctionOpen}
        onClose={() => setCorrectionOpen(false)}
        title="Request a checked correction"
        description="Confirmed money records keep their original history."
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const note = String(
              new FormData(event.currentTarget).get("reason"),
            ).trim();
            commit(
              (current) => ({
                ...current,
                activity: [
                  {
                    id: crypto.randomUUID(),
                    title: "Correction needs review",
                    detail: `${parcel.reference} · ${note}`,
                    at: new Date().toISOString(),
                    type: "notice",
                    href: `/deliveries/${parcel.id}`,
                  },
                  ...current.activity,
                ],
                notificationsRead: false,
              }),
              "Correction request saved for review. Existing amounts are unchanged.",
            );
            setCorrectionOpen(false);
          }}
        >
          <div className="dialog-body">
            <label className="field">
              <span>What needs to be reviewed?</span>
              <textarea
                name="reason"
                required
                minLength={5}
                maxLength={400}
                rows={4}
                placeholder="Explain the payment or delivery correction..."
              />
            </label>
          </div>
          <footer className="dialog-footer">
            <Button
              variant="secondary"
              onClick={() => setCorrectionOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit">Record review request</Button>
          </footer>
        </form>
      </Modal>
    </>
  );
}
