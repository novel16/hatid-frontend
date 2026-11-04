"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCheck,
  Clock,
  Package,
  Phone,
  RotateCcw,
  ShieldCheck,
  MapPin,
  Navigation,
} from "lucide-react";
import { useActions } from "@/components/providers";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  LinkButton,
  PageHeading,
  StatusBadge,
} from "@/components/ui";
import {
  ApiError,
  errorMessage,
  type ApiDelivery,
  type ApiParcel,
} from "@/lib/api";
import { formatDate, money } from "@/lib/prototype/domain";
import type { ParcelStatus } from "@/lib/prototype/types";
import { AccountOutcomeDialog } from "./account-outcome-dialog";
import { AccountLocationDialog } from "@/features/customers/account-location-dialog";
import {
  deliverySelection,
  hasCoordinates,
  isReadyParcel,
  navigationUrl,
} from "@/lib/maps";
import { useParcelEntry } from "@/features/parcels/parcel-entry-screen";

/** Displays owned cross-week handovers with optional, separately confirmed delivery-verified location review. */
export function AccountDeliveryDetail({ parcelId }: { parcelId: string }) {
  const { request, notify, session } = useActions();
  const { revision: parcelRevision } = useParcelEntry();
  const loadedStop = useRef<string | null>(null);
  const [stop, setStop] = useState<ApiDelivery | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [revision, setRevision] = useState(0);
  const [resolvedRead, setResolvedRead] = useState("");
  const readKey = `${parcelId}:${revision}:${parcelRevision}`;
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [outcome, setOutcome] = useState<ParcelStatus | null>(null);
  const [locationEvidence, setLocationEvidence] = useState<number | null>(null);

  /** A parcel reference anchors the complete stop across all original intake weeks. */
  useEffect(() => {
    let active = true;
    request<{ data: ApiDelivery }>(
      `/deliveries/${encodeURIComponent(parcelId)}`,
    ).then(
      /** Begin with only eligible open parcels selected; every selection remains editable. */
      (response) => {
        if (!active) return;
        setStop(response.data);
        setError(null);
        const preserveSelection = loadedStop.current === parcelId;
        loadedStop.current = parcelId;
        setSelectedIds(
          /** Background additions must not overwrite the rider's explicit partial selection. */ (
            current,
          ) =>
            deliverySelection(
              response.data.parcels,
              preserveSelection ? current : undefined,
            ),
        );
        setResolvedRead(readKey);
        setLoading(false);
      },
      /** Foreign/missing stops and connection failures have separate retryable UI states. */
      (cause) => {
        if (active) {
          setError(
            cause instanceof ApiError
              ? cause
              : new ApiError(errorMessage(cause), 0),
          );
          setResolvedRead(readKey);
          setLoading(false);
        }
      },
    );
    /** Discard responses for a stop the rider already left. */
    return () => {
      active = false;
    };
  }, [request, parcelId, revision, parcelRevision, readKey]);

  /** Explicit reload fetches current outcomes from other devices and due holds. */
  function refresh() {
    setLoading(true);
    setError(null);
    setRevision(/** Re-run the same owned read. */ (current) => current + 1);
  }

  /** Merge only server-confirmed selected outcomes; unrelated parcels retain their current state. */
  function saved(parcels: ApiParcel[]) {
    setStop(
      /** Preserve all stop metadata and unselected parcels. */ (current) =>
        current
          ? {
              ...current,
              parcels: current.parcels.map(
                /** Replace only IDs returned by the confirmed atomic write. */ (
                  parcel,
                ) =>
                  parcels.find(
                    /** Match one confirmed resource. */ (updated) =>
                      updated.id === parcel.id,
                  ) ?? parcel,
              ),
            }
          : current,
    );
    setSelectedIds([]);
    notify("Delivery outcome saved to your account.");
    const delivered = parcels.find(
      /** A partial handover authorizes GPS only through its actually delivered parcel. */ (
        parcel,
      ) => parcel.status === "delivered" && !!parcel.receipt,
    );
    if (outcome === "delivered" && delivered) setLocationEvidence(delivered.id);
  }

  if (loading || resolvedRead !== readKey)
    return (
      <Card>
        <div className="card-body">
          <p role="status">Loading your delivery…</p>
        </div>
      </Card>
    );
  if (error || !stop)
    return (
      <Card>
        <EmptyState
          title={
            error?.status === 404
              ? "Delivery not found"
              : "Couldn’t load this delivery"
          }
          action={
            <>
              <LinkButton href="/deliveries" variant="secondary">
                All deliveries
              </LinkButton>
              {error?.status !== 404 && (
                <Button onClick={refresh}>Try again</Button>
              )}
            </>
          }
        >
          <span role="alert">
            {error?.message ?? "Choose a delivery from your own workspace."}
          </span>
        </EmptyState>
      </Card>
    );
  const selected = stop.parcels.filter(
    /** Closed parcels cannot be included in a new handover. */ (parcel) =>
      selectedIds.includes(parcel.id) &&
      !["delivered", "returned"].includes(parcel.status),
  );
  const ready =
    selected.length > 0 &&
    selected.every(
      /** Each parcel checks the current time, not its array index. */ (
        parcel,
      ) => isReadyParcel(parcel),
    );
  const navigation = session?.user.vehicle
    ? navigationUrl(stop.address, session.user.vehicle)
    : null;
  const deliveredEvidence = stop.parcels.find(
    /** Only actual returned delivery evidence enables optional GPS review. */ (
      parcel,
    ) =>
      parcel.status === "delivered" &&
      !!parcel.receipt &&
      parcel.attempts?.some((attempt) => attempt.outcome === "delivered"),
  );
  const resumable =
    selected.length > 0 &&
    selected.every(
      /** Pending work is already ready, so a resume is only meaningful for holds/failures. */ (
        parcel,
      ) => ["held", "failed"].includes(parcel.status),
    );
  const amount = selected.reduce(
    /** Each selected parcel retains its own full amount. */ (sum, parcel) =>
      sum + parcel.pricing.total,
    0,
  );
  const activity = stop.parcels
    .flatMap(
      /** Combine display history without relocating parcel evidence to another batch. */ (
        parcel,
      ) =>
        (parcel.attempts ?? []).map(
          /** Carry a readable reference with each attempt. */ (attempt) => ({
            ...attempt,
            reference: parcel.reference,
          }),
        ),
    )
    .sort(
      /** Most recent evidence appears first. */ (a, b) =>
        b.at.localeCompare(a.at) || b.id - a.id,
    );

  return (
    <>
      <LinkButton href="/deliveries" variant="ghost" className="back-link">
        <ArrowLeft size={15} />
        All deliveries
      </LinkButton>
      <PageHeading
        eyebrow="CUSTOMER HANDOVER"
        title={stop.customer.name}
        description="Review each parcel across intake weeks. Select only the parcels involved in this outcome."
      >
        <Button variant="secondary" onClick={refresh}>
          Refresh stop
        </Button>
      </PageHeading>
      <div className="detail-layout">
        <div className="form-stack">
          <Card>
            <div className="customer-detail-header">
              <Avatar name={stop.customer.name} />
              <div>
                <h2>{stop.customer.name}</h2>
                <p>{stop.customer.phone ?? "No phone provided"}</p>
                <span>
                  {stop.address.label} ·{" "}
                  {stop.address.text ?? "Address not provided"}
                </span>
              </div>
            </div>
            {stop.customer.phone && (
              <div className="customer-actions">
                <a
                  className="button button-secondary"
                  href={`tel:${stop.customer.phone}`}
                >
                  <Phone size={15} />
                  Call customer
                </a>
              </div>
            )}
            <div className="notice notice-muted address-missing-note">
              <p>Manual delivery is available even without a saved location.</p>
            </div>
            <div className="card-body form-stack">
              <Badge tone={hasCoordinates(stop.address) ? "green" : "amber"}>
                <MapPin size={14} />
                {hasCoordinates(stop.address)
                  ? "Verified address pin saved"
                  : "No saved address pin"}
              </Badge>
              {hasCoordinates(stop.address) && (
                <p className="small-muted">
                  {stop.address.latitude!.toFixed(6)},{" "}
                  {stop.address.longitude!.toFixed(6)}
                </p>
              )}
              <div className="form-grid">
                <LinkButton
                  href={`/map?parcel=${parcelId}`}
                  variant="secondary"
                >
                  View on map
                </LinkButton>
                {navigation && (
                  <a
                    className="button button-secondary"
                    href={navigation}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Navigation size={16} />
                    Navigate in Google Maps
                  </a>
                )}
                {deliveredEvidence && (
                  <Button
                    variant="secondary"
                    onClick={
                      /** Fresh GPS is optional and never rewrites the saved receipt. */ () =>
                        setLocationEvidence(deliveredEvidence.id)
                    }
                  >
                    Review / save address location
                  </Button>
                )}
              </div>
              {hasCoordinates(stop.address) && !session?.user.vehicle && (
                <LinkButton href="/settings" variant="ghost">
                  Choose your vehicle in Settings
                </LinkButton>
              )}
            </div>
          </Card>
          <Card
            title={`Parcels at this address`}
            description="Original intake weeks and frozen prices remain visible."
            action={<Badge>{stop.parcels.length} parcel(s)</Badge>}
          >
            <div className="parcel-detail-list">
              {stop.parcels.map(
                /** Render one saved parcel, not a combined payment assumption for the entire stop. */ (
                  parcel,
                ) => {
                  const closed = ["delivered", "returned"].includes(
                    parcel.status,
                  );
                  return (
                    <div
                      key={parcel.id}
                      className={`parcel-detail-item ${closed ? "parcel-completed" : ""}`}
                    >
                      <div className="parcel-item-top">
                        <label className="parcel-checkbox">
                          <input
                            type="checkbox"
                            aria-label={`Select ${parcel.reference}`}
                            disabled={closed}
                            checked={!closed && selectedIds.includes(parcel.id)}
                            onChange={
                              /** Allow a partial handover without changing any other parcel's outcome. */ (
                                event,
                              ) =>
                                setSelectedIds(
                                  event.target.checked
                                    ? [...selectedIds, parcel.id]
                                    : selectedIds.filter(
                                        /** Remove only this selection. */ (
                                          id,
                                        ) => id !== parcel.id,
                                      ),
                                )
                            }
                          />
                          <span>
                            <Package size={16} />
                          </span>
                        </label>
                        <div>
                          <strong>{parcel.reference}</strong>
                          <p>{parcel.description}</p>
                        </div>
                        <StatusBadge status={parcel.status} />
                      </div>
                      <div className="parcel-seller-line">
                        <span>{parcel.seller.name}</span>
                        <Badge
                          tone={
                            (parcel.receipt?.method ??
                              parcel.expected_method) === "gcash"
                              ? "blue"
                              : "gray"
                          }
                        >
                          {(parcel.receipt?.method ??
                            parcel.expected_method) === "gcash"
                            ? "GCash"
                            : "COD cash"}
                        </Badge>
                        <small>Fee {parcel.pricing.mode}</small>
                      </div>
                      <p className="small-muted">
                        <Link
                          className="text-link"
                          href={`/batches/${parcel.batch.id}`}
                        >
                          {parcel.batch.name}
                        </Link>{" "}
                        · {formatDate(parcel.batch.start)} –{" "}
                        {formatDate(parcel.batch.end)}
                      </p>
                      <div className="parcel-price-grid">
                        <div>
                          <span>Customer total</span>
                          <strong>{money(parcel.pricing.total)}</strong>
                        </div>
                        <div>
                          <span>Seller share</span>
                          <strong>{money(parcel.pricing.sellerShare)}</strong>
                        </div>
                        <div>
                          <span>Your fee</span>
                          <strong>{money(parcel.pricing.fee)}</strong>
                        </div>
                      </div>
                      {parcel.override_reason && (
                        <p className="parcel-note">
                          Pricing override: {parcel.override_reason}
                        </p>
                      )}
                      {parcel.note && (
                        <p className="parcel-note">{parcel.note}</p>
                      )}
                      {parcel.retry_at && parcel.status === "held" && (
                        <p className="retry-note">
                          <Clock size={13} />
                          Retry {formatDate(parcel.retry_at, true)}
                        </p>
                      )}
                      {parcel.receipt && (
                        <p className="receipt-confirmed">
                          <ShieldCheck size={14} />
                          Rider confirmed{" "}
                          {parcel.receipt.method === "gcash"
                            ? "external GCash"
                            : "cash"}{" "}
                          receipt · {money(parcel.receipt.amount)} ·{" "}
                          {formatDate(parcel.receipt.confirmed_at, true)}
                          {parcel.receipt.reference
                            ? ` · ${parcel.receipt.reference}`
                            : ""}
                        </p>
                      )}
                    </div>
                  );
                },
              )}
            </div>
            <div className="selection-footer">
              <span>
                <strong>{selected.length}</strong> selected
              </span>
              <span>
                Total to collect <strong>{money(amount)}</strong>
              </span>
            </div>
          </Card>
          <Card
            title="Delivery activity"
            description="Every attempt stays attached to its original parcel."
          >
            <div className="timeline">
              {activity.length ? (
                activity.map(
                  /** Evidence is append-only; retrying never replaces an earlier reason. */ (
                    attempt,
                  ) => (
                    <div key={attempt.id}>
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
                        <small>
                          {formatDate(attempt.at, true)}
                          {attempt.retry_at
                            ? ` · Retry ${formatDate(attempt.retry_at, true)}`
                            : ""}
                        </small>
                      </div>
                    </div>
                  ),
                )
              ) : (
                <p className="small-muted">
                  No attempts yet. Your first saved outcome will appear here.
                </p>
              )}
            </div>
          </Card>
        </div>
        <aside className="detail-aside form-stack">
          <Card
            title="Record this handover"
            description="Only the selected parcels will change."
          >
            <div className="card-body form-stack">
              <div className="handover-total">
                <span>Selected customer total</span>
                <strong>{money(amount)}</strong>
                <small>
                  {selected.length} parcel(s) · saved fees already accounted for
                </small>
              </div>
              <Button
                className="button-full"
                disabled={!ready}
                onClick={
                  /** Open full payment confirmation for the frozen selection. */ () =>
                    setOutcome("delivered")
                }
              >
                <CheckCheck size={17} />
                Mark delivered
              </Button>
              {selected.length > 0 && !ready && (
                <p className="small-muted">
                  Resume failed or future-held parcels before marking them
                  delivered.
                </p>
              )}
              <div className="form-grid">
                <Button
                  variant="secondary"
                  disabled={!selected.length}
                  onClick={
                    /** Hold adds a future schedule, without collecting money. */ () =>
                      setOutcome("held")
                  }
                >
                  <Clock size={15} />
                  Hold
                </Button>
                <Button
                  variant="secondary"
                  disabled={!selected.length}
                  onClick={
                    /** A failed attempt remains open and keeps its original batch. */ () =>
                      setOutcome("failed")
                  }
                >
                  Failed attempt
                </Button>
              </div>
              <Button
                variant="ghost"
                disabled={!resumable}
                onClick={
                  /** Explicitly resume eligible held/failed selections, including an early manual retry. */ () =>
                    setOutcome("pending")
                }
              >
                <RotateCcw size={15} />
                Resume delivery / retry
              </Button>
              <Button
                variant="ghost"
                disabled={!selected.length}
                onClick={
                  /** Returning requires a separate physical seller-handover confirmation. */ () =>
                    setOutcome("returned")
                }
              >
                Return to seller
              </Button>
              <div className="notice notice-muted">
                <ShieldCheck size={17} />
                <p>
                  Only a delivered parcel with rider-confirmed full payment adds
                  its retained fee. Collection and remittance reports remain a
                  separate feature.
                </p>
              </div>
            </div>
          </Card>
        </aside>
      </div>
      {outcome && (
        <AccountOutcomeDialog
          anchorId={parcelId}
          parcels={selected}
          outcome={outcome}
          onSaved={saved}
          onClose={
            /** The confirmed server response is applied before the dialog closes. */ () =>
              setOutcome(null)
          }
        />
      )}
      {locationEvidence !== null && (
        <AccountLocationDialog
          parcelId={locationEvidence}
          address={stop.address}
          customerName={stop.customer.name}
          onSaved={
            /** Apply the server-confirmed address and stop without changing selection or receipts locally. */ (
              updated,
            ) => setStop(updated)
          }
          onClose={
            /** Skip closes only the optional location step. */ () =>
              setLocationEvidence(null)
          }
        />
      )}
    </>
  );
}
