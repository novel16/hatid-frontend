"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Info,
  MapPin,
  Package,
  Plus,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { usePrototypeState } from "@/lib/prototype/store";
import {
  addParcel,
  money,
  moneyInput,
  parseMoney,
  priceParcel,
} from "@/lib/prototype/domain";
import type {
  FeeMode,
  Parcel,
  PaymentMethod,
  Pricing,
} from "@/lib/prototype/types";
import { useActions } from "@/components/providers";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CheckField,
  Field,
  LinkButton,
  PageHeading,
} from "@/components/ui";
import { CustomerPicker } from "@/features/customers/customer-dialog";
import { SellerDialog } from "@/features/sellers/seller-dialog";

/** Encodes demo parcels with frozen pricing while reusing customer/seller forms. */
export function ParcelEntryScreen() {
  const state = usePrototypeState();
  const { commit, notify } = useActions();
  const router = useRouter();
  const [saving, startTransition] = useTransition();
  const [customerId, setCustomerId] = useState("");
  const [addressId, setAddressId] = useState("");
  const [sellerId, setSellerId] = useState(state.sellers[0]?.id ?? "");
  const [batchId, setBatchId] = useState(state.selectedBatchId);
  const [quote, setQuote] = useState("115");
  const [fee, setFee] = useState(moneyInput(state.sellers[0]?.fee ?? 1500));
  const [mode, setMode] = useState<FeeMode>(
    state.sellers[0]?.mode ?? "included",
  );
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [override, setOverride] = useState(false);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [sellerOpen, setSellerOpen] = useState(false);
  const customer = state.customers.find((item) => item.id === customerId);
  const seller = state.sellers.find((item) => item.id === sellerId);
  const address = customer?.addresses.find((item) => item.id === addressId);
  let preview: Pricing | null = null;
  try {
    preview = priceParcel(parseMoney(quote), parseMoney(fee), mode);
  } catch {
    /* Invalid input is explained on submit. */
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const intent = (event.nativeEvent as SubmitEvent).submitter?.getAttribute(
      "value",
    );
    try {
      if (!customer || !address)
        throw new Error("Choose a customer and address first.");
      const pricing = priceParcel(parseMoney(quote), parseMoney(fee), mode);
      const id = crypto.randomUUID();
      const parcel: Parcel = {
        id,
        reference: `HTD-${String(2401 + state.parcels.length)}`,
        customerId,
        addressId,
        sellerId,
        batchId,
        description: String(values.get("description")).trim() || "Parcel",
        expectedMethod: method,
        pricing,
        status: "pending",
        receipt: null,
        note: String(values.get("note")).trim(),
        attempts: [],
        overrideReason: override
          ? String(values.get("override_reason")).trim()
          : undefined,
      };
      if (
        commit(
          (current) => addParcel(current, parcel),
          `${parcel.reference} saved on this device.`,
        )
      ) {
        if (intent === "another") {
          setQuote("");
          form.reset();
        } else startTransition(() => router.push(`/deliveries/${id}`));
      }
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Review the parcel details.",
        true,
      );
    }
  }

  function chooseSeller(id: string) {
    const chosen = state.sellers.find((item) => item.id === id);
    if (chosen) {
      setSellerId(id);
      setMode(chosen.mode);
      setFee(moneyInput(chosen.fee));
      setOverride(false);
    }
  }

  return (
    <>
      <LinkButton href="/deliveries" variant="ghost" className="back-link">
        <ArrowLeft size={15} />
        Back to deliveries
      </LinkButton>
      <PageHeading
        eyebrow="QUICK PARCEL ENTRY"
        title="A new parcel, a clear handover."
        description="Set the customer and seller. We’ll keep the fee breakdown clear."
      />
      <form onSubmit={submit} className="entry-layout">
        <div className="form-stack">
          <Card
            title="1. Customer & destination"
            description="Search existing customers before adding a new one."
            action={
              <span className="section-number">
                <UserRound size={19} />
              </span>
            }
          >
            <div className="card-body form-stack">
              {customer ? (
                <div className="selected-customer">
                  <Avatar name={customer.name} color={customer.color} />
                  <div>
                    <strong>{customer.name}</strong>
                    <small>{customer.phone}</small>
                  </div>
                  <Button variant="ghost" onClick={() => setCustomerOpen(true)}>
                    Change
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  className="customer-select-button"
                  onClick={() => setCustomerOpen(true)}
                >
                  <span>
                    <Search size={19} />
                    <span>Search or add a customer</span>
                  </span>
                  <ChevronDown size={17} />
                </button>
              )}
              {customer && (
                <Field label="Deliver to this address">
                  <select
                    value={addressId}
                    onChange={(event) => setAddressId(event.target.value)}
                  >
                    {customer.addresses.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.label} · {entry.text}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              {address && (
                <div
                  className={`notice ${address.latitude === null ? "notice-amber" : "notice-muted"}`}
                >
                  <MapPin size={18} />
                  <p>
                    {address.latitude === null
                      ? "No pin? No problem. This parcel can be delivered manually."
                      : "A confirmed pin is available for this address."}
                  </p>
                </div>
              )}
            </div>
          </Card>
          <Card
            title="2. Parcel details"
            description="Every parcel keeps its own seller and pricing snapshot."
            action={
              <span className="section-number">
                <Package size={19} />
              </span>
            }
          >
            <div className="card-body form-stack">
              <div className="form-grid">
                <Field label="Weekly batch" required>
                  <select
                    value={batchId}
                    onChange={(event) => setBatchId(event.target.value)}
                  >
                    {state.batches.map((batch) => (
                      <option key={batch.id} value={batch.id}>
                        {batch.name} · {batch.start}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Seller" required>
                  <select
                    value={sellerId}
                    onChange={(event) => chooseSeller(event.target.value)}
                  >
                    {state.sellers.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.name} · Fee {entry.mode}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="seller-preference">
                <span>
                  <Badge tone="green">Fee {seller?.mode}</Badge>
                  <small>
                    {seller?.name} · default fee {money(seller?.fee ?? 0)}
                  </small>
                </span>
                <button
                  type="button"
                  className="text-link"
                  onClick={() => setSellerOpen(true)}
                >
                  <Plus size={14} />
                  New seller
                </button>
              </div>
              <Field
                label="What’s inside?"
                hint="Optional. A short description helps at handover."
              >
                <input
                  name="description"
                  placeholder="e.g. Skincare bundle · 1 small parcel"
                  maxLength={150}
                />
              </Field>
              <div className="form-grid">
                <Field
                  label={
                    mode === "included"
                      ? "Customer total including delivery fee"
                      : "Seller amount before delivery fee"
                  }
                  required
                >
                  <div className="currency-input">
                    <span>₱</span>
                    <input
                      aria-label="Quoted parcel amount"
                      type="number"
                      required
                      min="0.01"
                      step="0.01"
                      value={quote}
                      onChange={(event) => setQuote(event.target.value)}
                    />
                  </div>
                </Field>
                <Field
                  label="Rider delivery fee"
                  hint={
                    override
                      ? "Your override is recorded on this parcel."
                      : "Uses the seller’s saved preference."
                  }
                  required
                >
                  <div className="currency-input">
                    <span>₱</span>
                    <input
                      aria-label="Rider delivery fee"
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      value={fee}
                      readOnly={!override}
                      onChange={(event) => setFee(event.target.value)}
                    />
                  </div>
                </Field>
              </div>
              <CheckField
                checked={override}
                onChange={(value) => {
                  setOverride(value);
                  if (!value && seller) {
                    setMode(seller.mode);
                    setFee(moneyInput(seller.fee));
                  }
                }}
              >
                Override the seller’s pricing for this parcel
              </CheckField>
              {override && (
                <div className="override-fields">
                  <Field label="Applied fee mode">
                    <select
                      value={mode}
                      onChange={(event) =>
                        setMode(event.target.value as FeeMode)
                      }
                    >
                      <option value="included">Included in quoted total</option>
                      <option value="excluded">
                        Excluded — add fee on top
                      </option>
                    </select>
                  </Field>
                  <Field label="Reason for override" required>
                    <input
                      name="override_reason"
                      required
                      placeholder="e.g. Seller confirmed a bundle price"
                      maxLength={200}
                    />
                  </Field>
                </div>
              )}
            </div>
          </Card>
          <Card
            title="3. Payment & notes"
            description="The rider confirms receipt at delivery."
          >
            <div className="card-body form-stack">
              <div className="payment-options">
                <button
                  type="button"
                  className={
                    method === "cash"
                      ? "payment-option selected"
                      : "payment-option"
                  }
                  onClick={() => setMethod("cash")}
                >
                  <span className="payment-method-symbol">₱</span>
                  <span>
                    <strong>COD cash</strong>
                    <small>Collect at handover</small>
                  </span>
                  {method === "cash" && <Check size={17} />}
                </button>
                <button
                  type="button"
                  className={
                    method === "gcash"
                      ? "payment-option selected"
                      : "payment-option"
                  }
                  onClick={() => setMethod("gcash")}
                >
                  <span className="payment-method-symbol gcash-symbol">G</span>
                  <span>
                    <strong>GCash</strong>
                    <small>Paid to the rider externally</small>
                  </span>
                  {method === "gcash" && <Check size={17} />}
                </button>
              </div>
              {method === "gcash" && (
                <div className="notice notice-blue">
                  <Info size={17} />
                  <p>
                    GCash is handled outside Hatid. Check your own account and
                    confirm the payment manually at delivery.
                  </p>
                </div>
              )}
              <Field label="Delivery notes">
                <textarea
                  name="note"
                  placeholder="Landmark, preferred time, or a reminder for yourself..."
                  rows={3}
                  maxLength={500}
                />
              </Field>
            </div>
          </Card>
          <div className="mobile-price-review">
            <span className="eyebrow">REVIEW BEFORE YOU SAVE</span>
            <strong>
              {preview ? money(preview.total) : "—"} <small>to collect</small>
            </strong>
            <div>
              <span>Seller share</span>
              <b>{preview ? money(preview.sellerShare) : "—"}</b>
            </div>
            <div>
              <span>Your retained fee · {mode}</span>
              <b>{preview ? money(preview.fee) : "—"}</b>
            </div>
          </div>
          <div className="form-actions">
            <LinkButton href="/deliveries" variant="secondary">
              Cancel
            </LinkButton>
            <Button
              type="submit"
              name="intent"
              value="another"
              variant="secondary"
              disabled={saving}
            >
              <Plus size={16} />
              Save & add another
            </Button>
            <Button type="submit" name="intent" value="save" disabled={saving}>
              <Check size={17} />
              {saving ? "Opening parcel…" : "Save parcel"}
            </Button>
          </div>
        </div>
        <aside className="entry-aside">
          <section className="pricing-review">
            <span className="eyebrow">BEFORE YOU SAVE</span>
            <h2>Here’s the breakdown.</h2>
            <p>{seller?.name ?? "Choose a seller"}</p>
            <div className="collect-total">
              <small>Collect from customer</small>
              <strong>{preview ? money(preview.total) : "—"}</strong>
              <Badge tone="green">Delivery fee {mode}</Badge>
            </div>
            <div className="review-line">
              <span>Seller share</span>
              <strong>{preview ? money(preview.sellerShare) : "—"}</strong>
            </div>
            <div className="review-line">
              <span>Your retained delivery fee</span>
              <strong>{preview ? money(preview.fee) : "—"}</strong>
            </div>
            <div className="review-proof">
              <ShieldCheck size={18} />
              <p>
                {mode === "included"
                  ? "The fee is already inside the quoted amount. It won’t be added twice."
                  : "The fee is added once on top of the seller’s amount."}
              </p>
            </div>
          </section>
          <div className="entry-tip">
            <span>
              <Info size={18} />
            </span>
            <div>
              <h3>A price you can trust later</h3>
              <p>
                These amounts stay with the parcel, even if the seller changes
                their defaults.
              </p>
            </div>
          </div>
          <p className="small-muted local-save-note">
            Prototype entries are saved in this browser.
          </p>
        </aside>
      </form>
      <CustomerPicker
        open={customerOpen}
        onClose={() => setCustomerOpen(false)}
        onSelect={(selected) => {
          setCustomerId(selected.id);
          setAddressId(selected.addresses[0].id);
        }}
      />
      {sellerOpen && (
        <SellerDialog
          onClose={() => setSellerOpen(false)}
          onSaved={(entry) => {
            setSellerId(entry.id);
            setMode(entry.mode);
            setFee(moneyInput(entry.fee));
            setOverride(false);
          }}
        />
      )}
    </>
  );
}
