"use client";

import { useState, type FormEvent } from "react";
import { Check, CircleAlert, CircleHelp, Store } from "lucide-react";
import type { FeeMode, Pricing, Seller } from "@/lib/prototype/types";
import {
  money,
  moneyInput,
  parseMoney,
  priceParcel,
  saveSeller,
} from "@/lib/prototype/domain";
import { ApiError, errorMessage } from "@/lib/api";
import { useActions } from "@/components/providers";
import { Button, Field, Modal } from "@/components/ui";

export interface SellerValues {
  name: string;
  contact: string | null;
  mode: FeeMode;
  fee: number;
}

/** Explains the same included/excluded pricing rule in both demo and account directories. */
export function SellerPricingGuide() {
  return (
    <div className="seller-guide-banner">
      <span>
        <Store size={23} />
      </span>
      <div>
        <h3>Included or excluded? Set it once, review it on every parcel.</h3>
        <p>
          Included ₱115 with a ₱15 fee → collect ₱115, seller gets ₱100.
          Excluded ₱100 + ₱15 → the same ₱115 customer total.
        </p>
      </div>
    </div>
  );
}

/** Reuses seller preferences for local demo records and private API save callbacks. */
export function SellerDialog({
  seller,
  onClose,
  onSaved,
  onSave,
}: {
  seller?: Seller;
  onClose: () => void;
  onSaved?: (seller: Seller) => void;
  onSave?: (values: SellerValues) => Promise<void>;
}) {
  const { commit } = useActions();
  const [mode, setMode] = useState<FeeMode | "">(seller?.mode ?? "");
  const [fee, setFee] = useState(moneyInput(seller?.fee ?? 1500));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  let preview: Pricing | null = null;
  try {
    if (mode)
      preview = priceParcel(
        mode === "included" ? 11500 : 10000,
        parseMoney(fee),
        mode,
      );
  } catch {
    preview = null;
  }

  /** Keeps pending preference changes from being dismissed. */
  function close() {
    if (!busy) onClose();
  }

  /** Uses the shared centavo parser and delegates persistence to the selected data source. */
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    setError("");
    setErrors({});
    setBusy(true);
    try {
      if (!mode)
        throw new Error(
          "Choose whether the delivery fee is included or excluded.",
        );
      const values: SellerValues = {
        name: String(form.get("name") ?? "").trim(),
        contact: String(form.get("contact") ?? "").trim() || null,
        fee: parseMoney(fee),
        mode,
      };
      if (onSave) {
        await onSave(values);
      } else {
        const next: Seller = {
          ...values,
          contact: values.contact ?? "",
          id: seller?.id ?? crypto.randomUUID(),
          color: seller?.color ?? "purple",
        };
        if (
          !commit(
            // Explicit demo saves preserve all existing parcel pricing snapshots.
            (state) => saveSeller(state, next),
            "Seller preferences saved. Existing parcels keep their original pricing.",
          )
        )
          return;
        onSaved?.(next);
      }
      onClose();
    } catch (cause) {
      setError(errorMessage(cause, "Check the fee amount."));
      if (cause instanceof ApiError) setErrors(cause.errors);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={close}
      title={seller ? "Seller preferences" : "Add a seller"}
      description={
        onSave
          ? "Private account defaults for future parcels."
          : "Make the delivery fee clear before the first parcel."
      }
    >
      <form method="post" onSubmit={submit}>
        <div className="dialog-body form-stack">
          {error && (
            <div className="form-error" role="alert">
              <CircleAlert size={18} />
              <p>{error}</p>
            </div>
          )}
          <Field label="Shop / seller name" required error={errors.name?.[0]}>
            <input
              name="name"
              required
              minLength={2}
              defaultValue={seller?.name}
              maxLength={100}
              placeholder="e.g. Aling Nena’s Shop"
              aria-invalid={!!errors.name}
            />
          </Field>
          <Field label="Contact person" error={errors.contact?.[0]}>
            <input
              name="contact"
              defaultValue={seller?.contact}
              maxLength={100}
              placeholder="Seller’s name"
              aria-invalid={!!errors.contact}
            />
          </Field>
          <Field
            label="Default rider delivery fee"
            required
            error={errors.fee?.[0]}
          >
            <div className="currency-input">
              <span>₱</span>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={fee}
                onChange={
                  /** Keep the exact decimal input until centavo validation. */ (
                    event,
                  ) => setFee(event.target.value)
                }
                aria-invalid={!!errors.fee}
              />
            </div>
          </Field>
          <Field
            label="How does this seller quote a parcel?"
            required
            error={errors.mode?.[0]}
          >
            <select
              required
              value={mode}
              onChange={
                /** Require an explicit seller fee inclusion preference. */ (
                  event,
                ) => setMode(event.target.value as FeeMode | "")
              }
              aria-invalid={!!errors.mode}
            >
              <option value="" disabled>
                Choose fee inclusion
              </option>
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
            {preview ? (
              <>
                <h3>
                  {money(preview.quote)} quote → {money(preview.total)} to
                  collect
                </h3>
                <p>
                  {money(preview.fee)} rider fee · {money(preview.sellerShare)}{" "}
                  seller share
                </p>
              </>
            ) : (
              <p>
                Choose a fee mode and valid fee. An included fee must fit within
                the example’s ₱115 quote.
              </p>
            )}
          </div>
          <div className="notice notice-muted">
            <CircleHelp size={17} />
            <p>
              Changing defaults affects new parcels. Saved parcel amounts and
              seller shares stay unchanged.
            </p>
          </div>
        </div>
        <footer className="dialog-footer">
          <Button variant="secondary" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            <Check size={16} />
            {busy ? "Saving…" : "Save seller"}
          </Button>
        </footer>
      </form>
    </Modal>
  );
}
