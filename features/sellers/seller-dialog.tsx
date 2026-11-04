"use client";

import { useState, type FormEvent } from "react";
import { Check, CircleHelp } from "lucide-react";
import type { FeeMode, Seller } from "@/lib/prototype/types";
import { money, parseMoney, saveSeller } from "@/lib/prototype/domain";
import { useActions } from "@/components/providers";
import { validationMessage, type NewSeller } from "@/lib/api";
import { Button, Field, Modal } from "@/components/ui";

/** Reuses seller fields for private account create/edit and explicit sample parcel choices. */
export function SellerDialog({
  seller,
  onClose,
  onSaved,
  onSave,
  initialValues,
}: {
  seller?: Seller;
  onClose: () => void;
  onSaved?: (seller: Seller) => void;
  onSave?: (values: NewSeller) => Promise<void>;
  initialValues?: NewSeller;
}) {
  const { commit, session } = useActions();
  const defaults = initialValues ?? seller;
  const [mode, setMode] = useState<FeeMode>(defaults?.mode ?? "included");
  const [fee, setFee] = useState(String((defaults?.fee ?? 1500) / 100));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Preserve a pending account save rather than closing over its eventual response. */
  function close() {
    if (!saving) onClose();
  }

  /** Saves allowlisted centavo values through the account callback or isolated demo store. */
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError(null);
    try {
      const values: NewSeller = {
        name: String(form.get("name") ?? "").trim(),
        contact: String(form.get("contact") ?? "").trim() || null,
        fee: parseMoney(fee),
        mode,
      };
      if (onSave) {
        await onSave(values);
      } else {
        if (session || initialValues)
          throw new Error(
            "Unable to save to your account. Close this form and try again.",
          );
        const next: Seller = {
          ...values,
          contact: values.contact ?? "",
          id: seller?.id ?? crypto.randomUUID(),
          color: seller?.color ?? "purple",
        };
        if (
          !commit(
            /** Sample changes never receive account seller IDs. */ (state) =>
              saveSeller(state, next),
            "Seller preferences saved. Existing parcels keep their original pricing.",
          )
        )
          return;
        onSaved?.(next);
      }
      onClose();
    } catch (cause) {
      setError(validationMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={close}
      closeDisabled={saving}
      title={defaults ? "Seller preferences" : "Add a seller"}
      description={
        onSave
          ? "Saved privately to your rider account. Existing parcel prices stay unchanged."
          : "Make the delivery fee clear before the first parcel."
      }
    >
      <form method="post" onSubmit={submit}>
        <div className="dialog-body form-stack">
          {error && (
            <p role="alert" className="notice notice-amber">
              {error}
            </p>
          )}
          <fieldset disabled={saving} className="form-stack form-fieldset">
            <Field label="Shop / seller name" required>
              <input
                name="name"
                required
                minLength={2}
                defaultValue={defaults?.name}
                maxLength={100}
                placeholder="e.g. Aling Nena’s Shop"
              />
            </Field>
            <Field label="Contact person">
              <input
                name="contact"
                defaultValue={defaults?.contact ?? ""}
                maxLength={100}
                placeholder="Seller’s name"
              />
            </Field>
            <Field label="Default rider delivery fee" required>
              <div className="currency-input">
                <span>₱</span>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={fee}
                  onChange={
                    /** Keep the entered peso value until centavo validation at save. */ (
                      event,
                    ) => setFee(event.target.value)
                  }
                />
              </div>
            </Field>
            <Field label="How does this seller quote a parcel?" required>
              <select
                value={mode}
                onChange={
                  /** Require one explicit fee inclusion rule. */ (event) =>
                    setMode(event.target.value as FeeMode)
                }
              >
                <option value="included">
                  Included — delivery fee is already in the quote
                </option>
                <option value="excluded">
                  Excluded — add the delivery fee on top
                </option>
              </select>
            </Field>
            <div className="pricing-example">
              <span className="eyebrow">QUICK EXAMPLE</span>
              {mode === "included" ? (
                <>
                  <h3>₱115 quote = ₱115 to collect</h3>
                  <p>The delivery fee is retained from the quoted amount.</p>
                </>
              ) : (
                <>
                  <h3>
                    ₱100 quote + {money(Math.round(Number(fee || 0) * 100))} fee
                  </h3>
                  <p>Add the rider fee once to the seller’s quoted amount.</p>
                </>
              )}
            </div>
            <div className="notice notice-muted">
              <CircleHelp size={17} />
              <p>
                Changing these defaults affects new parcels. Saved parcel
                amounts and seller shares stay unchanged.
              </p>
            </div>
          </fieldset>
        </div>
        <footer className="dialog-footer">
          <Button variant="secondary" onClick={close} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            <Check size={16} />
            {saving ? "Saving…" : "Save seller"}
          </Button>
        </footer>
      </form>
    </Modal>
  );
}
