"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, CircleAlert } from "lucide-react";
import { useActions } from "@/components/providers";
import { Badge, Button, CheckField, Field, Modal } from "@/components/ui";
import { ApiError, validationMessage, type ApiParcel } from "@/lib/api";
import { money } from "@/lib/prototype/domain";
import type { ParcelStatus, PaymentMethod } from "@/lib/prototype/types";
import { useNotifications } from "@/features/settings/account-notifications";

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
  const { request } = useActions();
  const { refresh: refreshNotifications } = useNotifications();
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
  const submission = useRef<Record<string, unknown> | null>(null);
  const viewVersion = useRef(0);
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

  /** Pending or interrupted money writes stay visible until their result is checked. */
  function close() {
    if (!saving && !uncertain) onClose();
  }

  /** Reuse an identical operation after connection failure; server rejects changed/duplicate evidence. */
  async function persist() {
    if (saving || !submission.current) return;
    const attempt = viewVersion.current;
    setSaving(true);
    setError("");
    try {
      const response = await request<{ data: ApiParcel[] }>(
        `/deliveries/${encodeURIComponent(anchorId)}/outcomes`,
        "POST",
        submission.current,
      );
      if (attempt !== viewVersion.current) return;
      refreshNotifications();
      onSaved(response.data);
      onClose();
    } catch (cause) {
      if (attempt !== viewVersion.current) return;
      const ambiguous =
        !(cause instanceof ApiError) ||
        cause.status === 0 ||
        cause.status >= 500 ||
        !!cause.errors.operation_id;
      setUncertain(ambiguous);
      if (!ambiguous) submission.current = null;
      setError(validationMessage(cause));
    } finally {
      if (attempt === viewVersion.current) setSaving(false);
    }
  }

  /** A full receipt is explicit per parcel; holding/failing/resuming creates no receipt. */
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || uncertain) return;
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
          <Button
            variant="secondary"
            disabled={saving || uncertain}
            onClick={close}
          >
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
