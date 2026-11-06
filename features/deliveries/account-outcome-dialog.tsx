"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, CircleAlert } from "lucide-react";
import { useActions } from "@/components/providers";
import {
  Badge,
  Button,
  CheckField,
  Field,
  LinkButton,
  Modal,
} from "@/components/ui";
import { validationMessage, type ApiParcel, type NewOutcome } from "@/lib/api";
import { money } from "@/lib/prototype/domain";
import type { ParcelStatus, PaymentMethod } from "@/lib/prototype/types";
import { useRecovery } from "@/features/settings/account-recovery";
import {
  RecoveryFailure,
  recoveryLocked,
  type RecoveryEntry,
} from "@/lib/recovery";

/** Confirms a manual outcome for a fixed selection with one stable operation on ambiguous retries. */
export function AccountOutcomeDialog({
  anchorId,
  parcels,
  outcome,
  onSaved,
  onClose,
}: {
  anchorId: string;
  parcels: ApiParcel[];
  outcome: ParcelStatus;
  onSaved: (parcels: ApiParcel[]) => void;
  onClose: () => void;
}) {
  const { request, notify } = useActions();
  const { create, send, check } = useRecovery();
  const recoveryEntry = useRef<RecoveryEntry | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [methods, setMethods] = useState<Record<number, PaymentMethod>>(
    Object.fromEntries(
      parcels.map(
        /** Default receipt choices use expected method, not assumed confirmation. */ (
          parcel,
        ) => [parcel.id, parcel.expected_method],
      ),
    ),
  );
  const submission = useRef<NewOutcome | null>(null);
  const viewVersion = useRef(0);
  const inFlight = useRef(false);
  const titles = {
    delivered: "Confirm delivery & full payment",
    held: "Put delivery on hold",
    failed: "Record a failed attempt",
    pending: "Resume delivery / retry",
    returned: "Confirm return to seller",
  };

  /** Ignore late saves after leaving this stop or changing accounts. */
  useEffect(() => {
    return () => {
      viewVersion.current += 1;
    };
  }, []);

  /** Frozen evidence is durable, so the rider can leave and recover it later. */
  function close() {
    if (!saving) onClose();
  }

  /** Reuse an identical operation after connection failure; server rejects changed/duplicate evidence. */
  async function persist() {
    if (saving || inFlight.current || !submission.current) return;
    inFlight.current = true;
    const attempt = viewVersion.current;
    setSaving(true);
    setError("");
    try {
      recoveryEntry.current ??= create("delivery");
      const observed = uncertain ? await check(recoveryEntry.current) : null;
      const result =
        observed?.state === "confirmed"
          ? { entry: observed.entry, response: null }
          : await send(observed?.entry ?? recoveryEntry.current, {
              kind: "delivery",
              anchorId: Number(anchorId),
              values: submission.current,
            });
      recoveryEntry.current = result.entry;
      if (attempt !== viewVersion.current) return;
      let data = (result.response as { data?: ApiParcel[] } | null)?.data;
      if (
        !Array.isArray(data) ||
        data.some(
          /** Bad success bodies must never grant fabricated GPS evidence. */ (
            parcel,
          ) =>
            !Number.isSafeInteger(parcel?.id) ||
            typeof parcel.status !== "string" ||
            !parcel.pricing,
        )
      ) {
        try {
          const response = await request<{ data: { parcels: ApiParcel[] } }>(
            `/deliveries/${encodeURIComponent(anchorId)}`,
          );
          data = response.data.parcels;
        } catch {
          notify(
            "Outcome confirmed. Open the saved delivery to review it and optionally save its location.",
          );
          data = [];
        }
      }
      if (attempt !== viewVersion.current) return;
      onSaved(
        data.filter(
          /** Only this selected successful outcome authorizes a location prompt. */ (
            parcel,
          ) => submission.current!.parcel_ids.includes(parcel.id),
        ),
      );
      onClose();
    } catch (cause) {
      if (attempt !== viewVersion.current) return;
      if (cause instanceof RecoveryFailure && cause.entry)
        recoveryEntry.current = cause.entry;
      const locked = recoveryEntry.current
        ? recoveryLocked(recoveryEntry.current)
        : false;
      setUncertain(locked);
      if (!locked) submission.current = null;
      setError(
        validationMessage(
          cause instanceof RecoveryFailure ? cause.cause : cause,
        ),
      );
    } finally {
      inFlight.current = false;
      if (attempt === viewVersion.current) setSaving(false);
    }
  }

  /** A full receipt is explicit per parcel; holding/failing/resuming creates no receipt. */
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || inFlight.current || uncertain) return;
    const form = new FormData(event.currentTarget);
    submission.current = {
      operation_id: crypto.randomUUID(),
      parcel_ids: parcels.map(
        /** Keep the exact selection through every retry. */ (parcel) =>
          parcel.id,
      ),
      outcome,
      note: String(form.get("note") ?? "").trim(),
      ...(outcome === "held"
        ? {
            retry_at: new Date(String(form.get("retry_at")))
              .toISOString()
              .replace(/\.\d{3}Z$/, "+00:00"),
          }
        : {}),
      ...(outcome === "returned" ? { handover_confirmed: confirmed } : {}),
      ...(outcome === "delivered"
        ? {
            receipt_confirmed: confirmed,
            receipts: parcels.map(
              /** Never infer a partial payment from the stop total. */ (
                parcel,
              ) => ({
                parcel_id: parcel.id,
                amount: parcel.pricing.total,
                method: methods[parcel.id],
                reference:
                  String(form.get(`reference-${parcel.id}`) ?? "").trim() ||
                  null,
              }),
            ),
          }
        : {}),
    };
    void persist();
  }

  return (
    <Modal
      open
      onClose={close}
      closeDisabled={saving}
      title={titles[outcome]}
      description={`${parcels.length} selected parcel(s). Other parcels and original intake weeks stay unchanged.`}
    >
      <form onSubmit={submit}>
        <div className="dialog-body form-stack">
          {error && (
            <p role="alert" className="notice notice-amber">
              {error}
            </p>
          )}
          {uncertain && (
            <div className="notice notice-amber">
              <p>
                The response was interrupted. Retry the same action to check its
                saved result.
              </p>
              <Button disabled={saving} onClick={persist}>
                {saving ? "Checking…" : "Retry same action"}
              </Button>
              <LinkButton href="/sync" onClick={onClose} variant="secondary">
                Open recovery
              </LinkButton>
            </div>
          )}
          <fieldset
            disabled={saving || uncertain}
            className="form-stack form-fieldset"
          >
            {outcome === "delivered" ? (
              <>
                <div className="confirmation-parcels">
                  {parcels.map(
                    /** Review amount, actual method and optional external reference for each parcel. */ (
                      parcel,
                    ) => (
                      <div key={parcel.id}>
                        <span>
                          <strong>{parcel.reference}</strong>
                          <small>
                            {parcel.seller.name} · {parcel.batch.name}
                          </small>
                        </span>
                        <strong>{money(parcel.pricing.total)}</strong>
                        <select
                          aria-label={`Payment received for ${parcel.reference}`}
                          value={methods[parcel.id]}
                          onChange={
                            /** Rider explicitly chooses how full payment was received. */ (
                              event,
                            ) =>
                              setMethods({
                                ...methods,
                                [parcel.id]: event.target
                                  .value as PaymentMethod,
                              })
                          }
                        >
                          <option value="cash">COD cash received</option>
                          <option value="gcash">
                            External GCash — rider confirmed
                          </option>
                        </select>
                        <input
                          name={`reference-${parcel.id}`}
                          aria-label={`Receipt reference for ${parcel.reference}`}
                          maxLength={100}
                          placeholder="Reference (optional)"
                        />
                      </div>
                    ),
                  )}
                </div>
                <div className="confirmation-total">
                  <span>
                    Customer total
                    <strong>
                      {money(
                        parcels.reduce(
                          /** Add only the selected full customer totals. */ (
                            sum,
                            parcel,
                          ) => sum + parcel.pricing.total,
                          0,
                        ),
                      )}
                    </strong>
                  </span>
                  <span>
                    Retained fee
                    <strong>
                      {money(
                        parcels.reduce(
                          /** Retain the saved fee once, after receipt confirmation. */ (
                            sum,
                            parcel,
                          ) => sum + parcel.pricing.fee,
                          0,
                        ),
                      )}
                    </strong>
                  </span>
                  <span>
                    Seller share
                    <strong>
                      {money(
                        parcels.reduce(
                          /** Preserve each parcel's frozen net allocation. */ (
                            sum,
                            parcel,
                          ) => sum + parcel.pricing.sellerShare,
                          0,
                        ),
                      )}
                    </strong>
                  </span>
                </div>
                {Object.values(methods).includes("gcash") && (
                  <div className="notice notice-blue">
                    <CircleAlert size={18} />
                    <p>
                      Check your own GCash account first. Hatid records your
                      confirmation and does not verify or transfer the payment.
                    </p>
                  </div>
                )}
                <CheckField checked={confirmed} onChange={setConfirmed}>
                  I handed over these parcels and personally confirmed full
                  payment for each one.
                </CheckField>
              </>
            ) : (
              <>
                {outcome === "held" && (
                  <Field label="Retry date & time" required>
                    <input type="datetime-local" name="retry_at" required />
                  </Field>
                )}
                {outcome === "returned" ? (
                  <CheckField checked={confirmed} onChange={setConfirmed}>
                    I physically handed these selected parcels back to their
                    sellers.
                  </CheckField>
                ) : (
                  <div className="notice notice-amber">
                    <CircleAlert size={18} />
                    <p>
                      No receipt or retained fee is added. A failed visit does
                      not mean the parcel was returned. Resuming a scheduled
                      hold makes it ready immediately.
                    </p>
                  </div>
                )}
              </>
            )}
            <Field
              label={
                outcome === "delivered" ? "Handover note" : "Reason / notes"
              }
              required
            >
              <textarea
                name="note"
                required
                minLength={3}
                maxLength={500}
                rows={3}
                defaultValue={
                  outcome === "delivered"
                    ? "Parcels handed over and full payment personally confirmed."
                    : ""
                }
              />
            </Field>
            <Badge tone="green">
              Original prices and previous attempts stay with each parcel
            </Badge>
          </fieldset>
        </div>
        <footer className="dialog-footer">
          <Button variant="secondary" disabled={saving} onClick={close}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={
              saving ||
              uncertain ||
              ((outcome === "delivered" || outcome === "returned") &&
                !confirmed)
            }
            variant={outcome === "failed" ? "danger" : "primary"}
          >
            <Check size={16} />
            {saving
              ? "Saving…"
              : outcome === "delivered"
                ? "Confirm delivered"
                : "Save outcome"}
          </Button>
        </footer>
      </form>
    </Modal>
  );
}
