"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, Info, Plus, ShieldCheck } from "lucide-react";
import { useActions } from "@/components/providers";
import { Badge, Button, Card, CheckField, Field, Modal } from "@/components/ui";
import {
  ApiError,
  errorMessage,
  validationMessage,
  type ApiBatch,
  type ApiCustomer,
  type ApiParcel,
  type ApiSeller,
  type NewParcel,
} from "@/lib/api";
import { money, parseMoney, priceParcel } from "@/lib/prototype/domain";
import type { FeeMode, PaymentMethod, Pricing } from "@/lib/prototype/types";
import {
  ParcelDirectorySelect,
  type DirectoryRecord,
} from "./parcel-directory";
import {
  AddressDialog,
  CustomerDialog,
  type AddressValues,
  type CustomerValues,
} from "@/features/customers/customer-dialog";
import { SellerDialog } from "@/features/sellers/seller-dialog";
import { BatchDialog } from "@/features/batches/batch-components";
import type { BatchPage, NewBatch, NewSeller } from "@/lib/api";

/** Encodes one owned parcel and freezes its reviewed amounts through the real API. */
export function AccountParcelEntry({
  initialBatchId,
  onClose,
  onSaved,
}: {
  initialBatchId?: string;
  onClose: () => void;
  onSaved: (another: boolean) => void;
}) {
  const { request, notify } = useActions();
  const initialBatch = initialBatchId;
  const [batch, setBatch] = useState<ApiBatch | null>(null);
  const [customer, setCustomer] = useState<ApiCustomer | null>(null);
  const [addressId, setAddressId] = useState("");
  const [seller, setSeller] = useState<ApiSeller | null>(null);
  const [creating, setCreating] = useState<"customer" | "seller" | null>(null);
  const [newBatch, setNewBatch] = useState<NewBatch | null>(null);
  const [openingBatch, setOpeningBatch] = useState(false);
  const [quote, setQuote] = useState("");
  const [fee, setFee] = useState("0");
  const [mode, setMode] = useState<FeeMode>("included");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [override, setOverride] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState("");
  const [addressOpen, setAddressOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const submission = useRef<{ values: NewParcel; another: boolean } | null>(
    null,
  );
  const viewVersion = useRef(0);
  const batchReadVersion = useRef(0);
  const activeAddresses =
    customer?.addresses.filter(
      /** Archived addresses are not available for new intake. */ (address) =>
        !address.archived_at,
    ) ?? [];
  let preview: Pricing | null = null;
  try {
    preview = priceParcel(parseMoney(quote), parseMoney(fee), mode);
  } catch {
    /* Invalid input is explained before save. */
  }

  /** Reject action responses after leaving this view or hiding a cached route. */
  useEffect(() => {
    return () => {
      viewVersion.current += 1;
    };
  }, []);

  /** A batch-detail entry link supplies an owned server batch, not a sample selection. */
  useEffect(() => {
    let active = true;
    const readVersion = ++batchReadVersion.current;
    if (initialBatch) {
      request<{ data: ApiBatch }>(
        `/batches/${encodeURIComponent(initialBatch)}`,
      ).then(
        /** Ignore a batch response if the user already left this entry view. */
        (response) => {
          if (active && readVersion === batchReadVersion.current)
            setBatch(response.data);
        },
        /** Invalid/foreign ranges leave the picker available and explain the error. */
        (cause) => {
          if (active && readVersion === batchReadVersion.current)
            setError(errorMessage(cause));
        },
      );
    }
    /** Cleanup prevents stale URL defaults from replacing another form. */
    return () => {
      active = false;
    };
  }, [initialBatch, request]);

  /** Restore seller defaults when the visible override option is turned off. */
  function toggleOverride(enabled: boolean) {
    setOverride(enabled);
    if (!enabled && seller) {
      setFee(String(seller.fee / 100));
      setMode(seller.mode);
    }
  }

  /** Retries a possibly saved operation with identical details instead of creating a duplicate. */
  async function persist() {
    if (saving || !submission.current) return;
    const attempt = viewVersion.current;
    const snapshot = submission.current;
    setSaving(true);
    setError("");
    try {
      const response = await request<{ data: ApiParcel }>(
        "/parcels",
        "POST",
        snapshot.values,
      );
      if (attempt !== viewVersion.current) return;
      const parcel = response?.data;
      if (
        !parcel ||
        !Number.isSafeInteger(parcel.id) ||
        parcel.id <= 0 ||
        typeof parcel.reference !== "string" ||
        !parcel.reference.trim()
      )
        throw new ApiError(
          "The parcel save could not be confirmed. Retry the same save.",
          0,
        );
      submission.current = null;
      setUncertain(false);
      notify(`${parcel.reference} saved to your account.`);
      if (snapshot.another) {
        formRef.current?.reset();
        setQuote("");
      }
      onSaved(snapshot.another);
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

  /** Snapshot the reviewed inputs once; validation failures preserve every field for correction. */
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || uncertain) return;
    try {
      if (!customer || !addressId || !seller || !batch)
        throw new Error(
          "Choose a customer, address, seller and weekly batch first.",
        );
      const values = new FormData(event.currentTarget);
      const pricing = priceParcel(parseMoney(quote), parseMoney(fee), mode);
      const reason = String(values.get("override_reason") ?? "").trim();
      if (override && reason.length < 3)
        throw new Error("Explain the pricing override before saving.");
      submission.current = {
        another:
          (event.nativeEvent as SubmitEvent).submitter?.getAttribute(
            "value",
          ) === "another",
        values: {
          operation_id: crypto.randomUUID(),
          batch_id: batch.id,
          customer_id: customer.id,
          address_id: Number(addressId),
          seller_id: seller.id,
          description: String(values.get("description") ?? "").trim(),
          note: String(values.get("note") ?? "").trim(),
          quote: pricing.quote,
          fee: pricing.fee,
          mode: pricing.mode,
          expected_method: method,
          ...(override ? { override_reason: reason } : {}),
        },
      };
      void persist();
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  /** Applies selected identities while retaining the parcel draft and seller pricing rules. */
  function selectRecord(record: DirectoryRecord | null) {
    if (!record) return;
    if ("addresses" in record) {
      setCustomer(record);
      setAddressId(
        String(
          record.addresses.find(
            /** Prefer a current destination, including addresses with unknown coordinates. */ (
              entry,
            ) => !entry.archived_at,
          )?.id ?? "",
        ),
      );
    } else if ("fee" in record) {
      setSeller(record);
      setFee(String(record.fee / 100));
      setMode(record.mode);
      setOverride(false);
    } else {
      batchReadVersion.current += 1;
      setBatch(record);
    }
  }

  /** Saves a new account identity through the existing shared form. */
  async function createCustomer(values: CustomerValues) {
    const attempt = viewVersion.current;
    const response = await request<{ data: ApiCustomer }>(
      "/customers",
      "POST",
      values,
    );
    if (attempt === viewVersion.current) selectRecord(response.data);
  }

  /** New seller preferences apply only to this unsaved parcel, not earlier snapshots. */
  async function createSeller(values: NewSeller) {
    const attempt = viewVersion.current;
    const response = await request<{ data: ApiSeller }>(
      "/sellers",
      "POST",
      values,
    );
    if (attempt === viewVersion.current) selectRecord(response.data);
  }

  /** Adds only label/text under the selected customer; no location evidence is fabricated. */
  async function addAddress(values: AddressValues) {
    if (!customer) return;
    const attempt = viewVersion.current;
    const response = await request<{ data: ApiCustomer }>(
      `/customers/${customer.id}/addresses`,
      "POST",
      values,
    );
    if (attempt !== viewVersion.current) return;
    setCustomer(response.data);
    setAddressId(String(response.data.addresses.at(-1)?.id ?? ""));
  }

  /** Get current server dates before opening the reusable batch form. */
  async function openBatch() {
    if (openingBatch) return;
    const attempt = viewVersion.current;
    const readVersion = batchReadVersion.current;
    setOpeningBatch(true);
    try {
      const response = await request<BatchPage>("/batches?per_page=1");
      if (
        attempt === viewVersion.current &&
        readVersion === batchReadVersion.current
      )
        setNewBatch(response.current_week);
    } catch (cause) {
      if (attempt === viewVersion.current) setError(errorMessage(cause));
    } finally {
      if (attempt === viewVersion.current) setOpeningBatch(false);
    }
  }

  /** Select the confirmed owned batch without leaving the parcel form. */
  async function createBatch(values: NewBatch) {
    const attempt = viewVersion.current;
    const response = await request<{ data: ApiBatch }>(
      "/batches",
      "POST",
      values,
    );
    if (attempt !== viewVersion.current) return;
    selectRecord(response.data);
    setNewBatch(null);
  }

  /** Preserve an unresolved operation and its identical retry payload until the API confirms it. */
  function close() {
    if (!saving && !uncertain) onClose();
  }

  return (
    <Modal
      open
      wide
      className="parcel-entry-dialog"
      title="Add parcel"
      description="Choose a customer, batch and seller. Review the amounts before saving."
      onClose={close}
      closeDisabled={saving || uncertain}
    >
      <div className="dialog-body form-stack">
        {error && (
          <p role="alert" className="notice notice-amber">
            {error}
          </p>
        )}
        {uncertain && (
          <div className="notice notice-amber">
            <p>
              The save response was interrupted. Keep these details and retry
              the same save to prevent duplicates.
            </p>
            <Button disabled={saving} onClick={persist}>
              {saving ? "Checking…" : "Retry same save"}
            </Button>
          </div>
        )}
        <form ref={formRef} onSubmit={submit} className="entry-layout">
          <fieldset
            disabled={saving || uncertain}
            className="form-stack form-fieldset"
          >
            <Card
              title="1. Customer & destination"
              description="Search your private directory or add a new customer."
            >
              <div className="card-body form-stack">
                <ParcelDirectorySelect
                  kind="customer"
                  value={customer}
                  onSelect={selectRecord}
                  required
                />
                <Button
                  variant="ghost"
                  onClick={
                    /** Create a customer without losing the parcel draft. */ () =>
                      setCreating("customer")
                  }
                >
                  <Plus size={15} /> New customer
                </Button>
                {customer && (
                  <>
                    <p className="small-muted">
                      {customer.phone ?? "No phone provided"}
                    </p>
                    <Field label="Deliver to this address" required>
                      <select
                        value={addressId}
                        required
                        onChange={
                          /** Preserve address identity separately from the customer. */ (
                            event,
                          ) => setAddressId(event.target.value)
                        }
                      >
                        <option value="">Choose an address</option>
                        {activeAddresses.map(
                          /** Unknown address text still permits manual delivery. */ (
                            address,
                          ) => (
                            <option key={address.id} value={address.id}>
                              {address.label} ·{" "}
                              {address.text ?? "Address not provided"}
                            </option>
                          ),
                        )}
                      </select>
                    </Field>
                    <Button
                      variant="ghost"
                      onClick={
                        /** Add another destination without leaving the draft. */ () => {
                          setAddressOpen(true);
                        }
                      }
                    >
                      <Plus size={15} />
                      Add address
                    </Button>
                  </>
                )}
                <p className="small-muted">
                  A saved pin is not required for manual delivery.
                </p>
              </div>
            </Card>
            <Card
              title="2. Parcel & seller"
              description="Each parcel keeps its original batch and its own fixed pricing."
            >
              <div className="card-body form-stack">
                <div className="form-grid">
                  <div className="form-stack">
                    <ParcelDirectorySelect
                      kind="batch"
                      value={batch}
                      onSelect={selectRecord}
                      required
                    />
                    {batch && (
                      <small className="small-muted">
                        {batch.start} – {batch.end}
                      </small>
                    )}
                    <Button
                      variant="ghost"
                      disabled={openingBatch}
                      onClick={openBatch}
                    >
                      <Plus size={15} />{" "}
                      {openingBatch ? "Loading…" : "New weekly batch"}
                    </Button>
                  </div>
                  <div className="form-stack">
                    <ParcelDirectorySelect
                      kind="seller"
                      value={seller}
                      onSelect={selectRecord}
                      required
                    />
                    <Button
                      variant="ghost"
                      onClick={
                        /** Create and select actual seller defaults. */ () =>
                          setCreating("seller")
                      }
                    >
                      <Plus size={15} /> New seller
                    </Button>
                  </div>
                </div>
                {seller && (
                  <div className="seller-preference">
                    <Badge tone="green">Fee {seller.mode}</Badge>
                    <small>Saved default: {money(seller.fee)}</small>
                  </div>
                )}
                <Field label="What’s inside?" hint="Optional">
                  <input
                    name="description"
                    maxLength={150}
                    placeholder="e.g. Skincare bundle"
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
                        min="0.01"
                        max="9999999.99"
                        step="0.01"
                        required
                        value={quote}
                        onChange={
                          /** Parse decimal input into centavos only at the domain boundary. */ (
                            event,
                          ) => setQuote(event.target.value)
                        }
                      />
                    </div>
                  </Field>
                  <Field label="Rider delivery fee" required>
                    <div className="currency-input">
                      <span>₱</span>
                      <input
                        aria-label="Rider delivery fee"
                        type="number"
                        min="0"
                        max="9999999.99"
                        step="0.01"
                        required
                        disabled={!override}
                        value={fee}
                        onChange={
                          /** An override remains visible and requires a reason. */ (
                            event,
                          ) => setFee(event.target.value)
                        }
                      />
                    </div>
                  </Field>
                </div>
                <CheckField checked={override} onChange={toggleOverride}>
                  Override this seller’s defaults for this parcel
                </CheckField>
                {override && (
                  <>
                    <Field label="Applied delivery fee mode">
                      <select
                        value={mode}
                        onChange={
                          /** The preview immediately reflects an explicit fee-mode override. */ (
                            event,
                          ) => setMode(event.target.value as FeeMode)
                        }
                      >
                        <option value="included">Included in quote</option>
                        <option value="excluded">Excluded — add on top</option>
                      </select>
                    </Field>
                    <Field label="Reason for pricing override" required>
                      <input
                        name="override_reason"
                        required
                        minLength={3}
                        maxLength={400}
                      />
                    </Field>
                  </>
                )}
              </div>
            </Card>
            <Card title="3. Payment & notes">
              <div className="card-body form-stack">
                <Field label="Expected payment method">
                  <select
                    value={method}
                    onChange={
                      /** Expected method can be confirmed or changed at actual receipt. */ (
                        event,
                      ) => setMethod(event.target.value as PaymentMethod)
                    }
                  >
                    <option value="cash">COD cash</option>
                    <option value="gcash">
                      GCash — manually confirmed by rider
                    </option>
                  </select>
                </Field>
                {method === "gcash" && (
                  <div className="notice notice-blue">
                    <Info size={17} />
                    <p>
                      GCash is paid to your external account. Hatid does not
                      process or verify the transfer.
                    </p>
                  </div>
                )}
                <Field label="Delivery notes">
                  <textarea
                    name="note"
                    rows={3}
                    maxLength={500}
                    placeholder="Landmark, preferred time or reminder…"
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
                <span>Your fee · {mode}</span>
                <b>{preview ? money(preview.fee) : "—"}</b>
              </div>
            </div>
          </fieldset>
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
                <span>Your retained fee</span>
                <strong>{preview ? money(preview.fee) : "—"}</strong>
              </div>
              <div className="review-proof">
                <ShieldCheck size={18} />
                <p>
                  {mode === "included"
                    ? "The fee is already inside the quote. It is retained once."
                    : "The fee is added once on top of the seller amount."}
                </p>
              </div>
            </section>
            <p className="small-muted local-save-note">
              Saved online to your account. No receipt or earnings are recorded
              until delivery and full payment are confirmed.
            </p>
          </aside>
          <footer className="dialog-footer parcel-entry-actions">
            <Button
              variant="secondary"
              onClick={close}
              disabled={saving || uncertain}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              value="another"
              variant="secondary"
              disabled={saving || uncertain}
            >
              <Plus size={16} />
              Save & add another
            </Button>
            <Button type="submit" value="save" disabled={saving || uncertain}>
              <Check size={16} />
              {saving ? "Saving…" : "Save parcel"}
            </Button>
          </footer>
        </form>
      </div>
      {creating === "customer" && (
        <CustomerDialog
          open
          onClose={/** Return to the same draft. */ () => setCreating(null)}
          onSave={createCustomer}
        />
      )}
      {creating === "seller" && (
        <SellerDialog
          onClose={/** Return to the same draft. */ () => setCreating(null)}
          onSave={createSeller}
        />
      )}
      {addressOpen && (
        <AddressDialog
          onClose={
            /** Restore the selected destination after editing. */ () =>
              setAddressOpen(false)
          }
          onSave={addAddress}
        />
      )}
      {newBatch && (
        <BatchDialog
          initial={newBatch}
          onSave={createBatch}
          onClose={
            /** Keep the parcel draft when batch creation is cancelled. */ () =>
              setNewBatch(null)
          }
        />
      )}
    </Modal>
  );
}
