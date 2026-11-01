"use client";

import { useState } from "react";
import { Check, CheckCheck, CircleAlert, PackageCheck } from "lucide-react";
import { deliverParcels, money, recordOutcome } from "@/lib/prototype/domain";
import type { Parcel, PaymentMethod } from "@/lib/prototype/types";
import { useActions } from "@/components/providers";
import { Badge, Button, CheckField, Field, Modal } from "@/components/ui";

export function DeliveredDialog({
  parcels,
  onClose,
  onSaved,
}: {
  parcels: Parcel[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { commit } = useActions();
  const [confirmed, setConfirmed] = useState(false);
  const [methods, setMethods] = useState<Record<string, PaymentMethod>>(
    Object.fromEntries(
      parcels.map((parcel) => [parcel.id, parcel.expectedMethod]),
    ),
  );
  const amount = parcels.reduce((sum, parcel) => sum + parcel.pricing.total, 0);
  const fee = parcels.reduce((sum, parcel) => sum + parcel.pricing.fee, 0);
  return (
    <Modal
      open
      onClose={onClose}
      title="Confirm delivery & payment"
      description="Only the selected parcels will be marked delivered."
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!confirmed) return;
          const id = crypto.randomUUID();
          if (
            commit(
              (state) =>
                deliverParcels(
                  state,
                  parcels.map((parcel) => parcel.id),
                  methods,
                  id,
                  new Date().toISOString(),
                ),
              "Delivery and payment recorded.",
            )
          ) {
            onClose();
            onSaved();
          }
        }}
      >
        <div className="dialog-body form-stack">
          <div className="delivery-confirm-head">
            <span>
              <PackageCheck size={27} />
            </span>
            <div>
              <h3>
                {parcels.length} parcel{parcels.length === 1 ? "" : "s"} handed
                over
              </h3>
              <p>Confirm full payment for each selected parcel.</p>
            </div>
          </div>
          <div className="confirmation-parcels">
            {parcels.map((parcel) => (
              <div key={parcel.id}>
                <span>
                  <strong>{parcel.reference}</strong>
                  <small>{parcel.description}</small>
                </span>
                <strong>{money(parcel.pricing.total)}</strong>
                <select
                  aria-label={`Payment received for ${parcel.reference}`}
                  value={methods[parcel.id]}
                  onChange={(event) =>
                    setMethods((current) => ({
                      ...current,
                      [parcel.id]: event.target.value as PaymentMethod,
                    }))
                  }
                >
                  <option value="cash">COD cash received</option>
                  <option value="gcash">GCash — rider confirmed</option>
                </select>
              </div>
            ))}
          </div>
          <div className="confirmation-total">
            <span>
              Customer total<strong>{money(amount)}</strong>
            </span>
            <span>
              Your retained fee<strong>{money(fee)}</strong>
            </span>
            <span>
              Seller share<strong>{money(amount - fee)}</strong>
            </span>
          </div>
          {Object.values(methods).includes("gcash") && (
            <div className="notice notice-blue">
              <CircleAlert size={18} />
              <p>
                Check the GCash payment in your own account. Hatid does not
                verify or transfer GCash payments.
              </p>
            </div>
          )}
          <CheckField checked={confirmed} onChange={setConfirmed}>
            I handed over these parcels and personally confirmed their full
            payment.
          </CheckField>
          <Badge tone="green">
            <CheckCheck size={13} />
            Other parcels at this stop remain unchanged
          </Badge>
        </div>
        <footer className="dialog-footer">
          <Button variant="secondary" onClick={onClose}>
            Go back
          </Button>
          <Button type="submit" disabled={!confirmed}>
            <Check size={17} />
            Confirm delivered
          </Button>
        </footer>
      </form>
    </Modal>
  );
}

export type Outcome = "held" | "failed" | "returned" | "pending";

export function OutcomeDialog({
  parcels,
  outcome,
  onClose,
}: {
  parcels: Parcel[];
  outcome: Outcome;
  onClose: () => void;
}) {
  const { commit } = useActions();
  const [handover, setHandover] = useState(false);
  const title = {
    held: "Put delivery on hold",
    failed: "Record a failed attempt",
    returned: "Confirm return to seller",
    pending: "Resume this delivery",
  }[outcome];
  const reasons =
    outcome === "held"
      ? [
          "Customer requested a later time",
          "Customer is not available",
          "Waiting for seller instructions",
        ]
      : outcome === "failed"
        ? [
            "Customer could not be reached",
            "Customer refused the parcel",
            "Address could not be located",
          ]
        : outcome === "returned"
          ? ["Parcel handed back to seller"]
          : [
              "Customer is ready for delivery",
              "Retry approved by customer",
              "Seller confirmed a new attempt",
            ];
  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      description={`${parcels.length} selected parcel(s) · original batch and history are preserved.`}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (outcome === "returned" && !handover) return;
          const form = new FormData(event.currentTarget);
          const reason = String(form.get("reason"));
          const note = String(form.get("note")).trim();
          const retry = form.get("retry_at");
          if (
            commit(
              (state) =>
                recordOutcome(
                  state,
                  parcels.map((parcel) => parcel.id),
                  outcome,
                  `${reason}${note ? ": " + note : ""}`,
                  retry ? new Date(String(retry)).toISOString() : undefined,
                ),
              "Delivery outcome saved.",
            )
          )
            onClose();
        }}
      >
        <div className="dialog-body form-stack">
          <Field label="Reason" required>
            <select name="reason" required>
              {reasons.map((reason) => (
                <option key={reason}>{reason}</option>
              ))}
            </select>
          </Field>
          {outcome === "held" && (
            <Field label="Retry date & time" required>
              <input
                name="retry_at"
                type="datetime-local"
                required
                defaultValue="2026-11-02T16:00"
              />
            </Field>
          )}
          <Field label="Notes">
            <textarea
              name="note"
              rows={3}
              maxLength={400}
              placeholder="Add a useful detail for your next attempt..."
            />
          </Field>
          {outcome === "returned" ? (
            <CheckField checked={handover} onChange={setHandover}>
              I physically handed these parcels back to the seller.
            </CheckField>
          ) : (
            <div className="notice notice-amber">
              <CircleAlert size={18} />
              <p>
                No payment receipt or retained fee is added by this action. A
                failed visit does not mean a parcel has been returned.
              </p>
            </div>
          )}
        </div>
        <footer className="dialog-footer">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant={outcome === "failed" ? "danger" : "primary"}
            disabled={outcome === "returned" && !handover}
          >
            <Check size={16} />
            {outcome === "pending" ? "Ready to deliver" : "Save outcome"}
          </Button>
        </footer>
      </form>
    </Modal>
  );
}
