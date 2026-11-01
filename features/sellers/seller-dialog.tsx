"use client";

import { useState } from "react";
import { Check, CircleHelp } from "lucide-react";
import type { FeeMode, Seller } from "@/lib/prototype/types";
import { money, parseMoney, saveSeller } from "@/lib/prototype/domain";
import { useActions } from "@/components/providers";
import { Button, Field, Modal } from "@/components/ui";

export function SellerDialog({
  seller,
  onClose,
  onSaved,
}: {
  seller?: Seller;
  onClose: () => void;
  onSaved?: (seller: Seller) => void;
}) {
  const { commit, notify } = useActions();
  const [mode, setMode] = useState<FeeMode>(seller?.mode ?? "included");
  const [fee, setFee] = useState(String((seller?.fee ?? 1500) / 100));
  return (
    <Modal
      open
      onClose={onClose}
      title={seller ? "Seller preferences" : "Add a seller"}
      description="Make the delivery fee clear before the first parcel."
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          try {
            const next: Seller = {
              id: seller?.id ?? crypto.randomUUID(),
              name: String(form.get("name")).trim(),
              contact: String(form.get("contact")).trim(),
              fee: parseMoney(fee),
              mode,
              color: seller?.color ?? "purple",
            };
            if (
              commit(
                (state) => saveSeller(state, next),
                "Seller preferences saved. Existing parcels keep their original pricing.",
              )
            ) {
              onSaved?.(next);
              onClose();
            }
          } catch (error) {
            notify(
              error instanceof Error ? error.message : "Check the fee amount.",
              true,
            );
          }
        }}
      >
        <div className="dialog-body form-stack">
          <Field label="Shop / seller name" required>
            <input
              name="name"
              required
              defaultValue={seller?.name}
              maxLength={100}
              placeholder="e.g. Aling Nena’s Shop"
            />
          </Field>
          <Field label="Contact person">
            <input
              name="contact"
              defaultValue={seller?.contact}
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
                onChange={(event) => setFee(event.target.value)}
              />
            </div>
          </Field>
          <Field label="How does this seller quote a parcel?" required>
            <select
              value={mode}
              onChange={(event) => setMode(event.target.value as FeeMode)}
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
              Changing these defaults affects new parcels. Saved parcel amounts
              and seller shares stay unchanged.
            </p>
          </div>
        </div>
        <footer className="dialog-footer">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">
            <Check size={16} />
            Save seller
          </Button>
        </footer>
      </form>
    </Modal>
  );
}
