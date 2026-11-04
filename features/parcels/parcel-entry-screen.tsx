"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ComponentProps,
  type FormEvent,
  type ReactNode,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Check,
  Info,
  MapPin,
  Package,
  Plus,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { usePrototypeState } from "@/lib/prototype/store";
import {
  addParcel,
  money,
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
import { Badge, Button, Card, CheckField, Field, Modal } from "@/components/ui";
import { CustomerDialog } from "@/features/customers/customer-dialog";
import { SellerDialog } from "@/features/sellers/seller-dialog";
import { AccountParcelEntry } from "./account-parcel-entry";
import { SearchSelect } from "@/components/search-select";
import { getSelectPage } from "@/lib/pagination";
import { directoryDescription } from "./parcel-directory";

interface ParcelEntryActions {
  openParcel: (batchId?: string) => void;
  revision: number;
}
const ParcelEntryContext = createContext<ParcelEntryActions | null>(null);

/** Owns one modal per verified account or explicit demo workspace. */
export function ParcelEntryProvider({ children }: { children: ReactNode }) {
  const { session } = useActions();
  return (
    <ParcelEntryHost key={session?.user.id ?? "demo"} account={!!session}>
      {children}
    </ParcelEntryHost>
  );
}

/** Keeps modal opening and save notifications with this feature rather than authentication. */
function ParcelEntryHost({
  children,
  account,
}: {
  children: ReactNode;
  account: boolean;
}) {
  const [draft, setDraft] = useState<{ batchId?: string } | null>(null);
  const [revision, setRevision] = useState(0);
  const openParcel = useCallback(
    /** Repeated triggers cannot replace an open or unresolved draft. */ (
      batchId?: string,
    ) =>
      setDraft(
        /** Preserve selections if a modal already exists. */ (current) =>
          current ?? { batchId },
      ),
    [],
  );
  const close = useCallback(
    /** Explicit dismissal releases this in-memory draft. */ () =>
      setDraft(null),
    [],
  );
  const saved = useCallback(
    /** Refresh account lists only after confirmed persistence. */ (
      another: boolean,
    ) => {
      setRevision(
        /** Signal a saved parcel, not a field edit. */ (current) =>
          current + 1,
      );
      if (!another) setDraft(null);
    },
    [],
  );
  return (
    <ParcelEntryContext.Provider value={{ openParcel, revision }}>
      {children}
      {draft &&
        (account ? (
          <AccountParcelEntry
            initialBatchId={draft.batchId}
            onClose={close}
            onSaved={saved}
          />
        ) : (
          <DemoParcelEntry
            initialBatchId={draft.batchId}
            onClose={close}
            onSaved={saved}
          />
        ))}
    </ParcelEntryContext.Provider>
  );
}

/** Exposes the same opening action and save revision to every workspace entry point. */
export function useParcelEntry() {
  const context = useContext(ParcelEntryContext);
  if (!context)
    throw new Error("Parcel entry must be used inside the rider workspace.");
  return context;
}

/** Reuses normal button styles while opening the modal without navigating away. */
export function AddParcelButton({
  batchId,
  children,
  ...props
}: Omit<ComponentProps<typeof Button>, "onClick"> & { batchId?: string }) {
  const { openParcel } = useParcelEntry();
  return (
    <Button
      {...props}
      onClick={
        /** Apply the current intake week as a changeable default. */ () =>
          openParcel(batchId)
      }
    >
      {children ?? (
        <>
          <Plus size={17} />
          Add parcel
        </>
      )}
    </Button>
  );
}

/** Old entry URLs open the shared modal over Deliveries rather than a separate form page. */
export function ParcelEntryScreen() {
  const { openParcel } = useParcelEntry();
  const router = useRouter();
  const params = useSearchParams();
  const batchId = params.get("batch") ?? undefined;
  useEffect(
    /** Retain bookmarks while moving the actual form into the workspace modal. */ () => {
      openParcel(batchId);
      router.replace("/deliveries");
    },
    [batchId, openParcel, router],
  );
  return null;
}

/** Preserve the existing sample entry workflow without accepting real account IDs. */
function DemoParcelEntry({
  initialBatchId,
  onClose,
  onSaved,
}: {
  initialBatchId?: string;
  onClose: () => void;
  onSaved: (another: boolean) => void;
}) {
  const state = usePrototypeState();
  const { commit, notify } = useActions();
  const [customerId, setCustomerId] = useState("");
  const [addressId, setAddressId] = useState("");
  const [sellerId, setSellerId] = useState(state.sellers[0]?.id ?? "");
  const [batchId, setBatchId] = useState(
    initialBatchId ?? state.selectedBatchId,
  );
  const [quote, setQuote] = useState("115");
  const [fee, setFee] = useState(String((state.sellers[0]?.fee ?? 1500) / 100));
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

  const loadCustomers = useCallback(
    /** Demo choices search only already-loaded sample records. */ async (
      query: string,
      page: number,
    ) => getSelectPage(state.customers, query, page, directoryDescription),
    [state.customers],
  );
  const loadBatches = useCallback(
    /** Sample weeks never reuse real account identifiers. */ async (
      query: string,
      page: number,
    ) => getSelectPage(state.batches, query, page, directoryDescription),
    [state.batches],
  );
  const loadSellers = useCallback(
    /** Keep demo seller preferences isolated from account records. */ async (
      query: string,
      page: number,
    ) => getSelectPage(state.sellers, query, page, directoryDescription),
    [state.sellers],
  );

  /** Save a sample parcel while retaining relationships when adding another. */
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
        }
        onSaved(intent === "another");
      }
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Review the parcel details.",
        true,
      );
    }
  }

  /** Apply the chosen sample seller's defaults to the unsaved pricing preview. */
  function chooseSeller(id: string) {
    const chosen = state.sellers.find((item) => item.id === id);
    if (chosen) {
      setSellerId(id);
      setMode(chosen.mode);
      setFee(String(chosen.fee / 100));
      setOverride(false);
    }
  }

  return (
    <Modal
      open
      wide
      className="parcel-entry-dialog"
      onClose={onClose}
      title="Add parcel"
      description="Sample parcel entry. Search your customer, batch and seller before saving."
    >
      <div className="dialog-body">
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
                <SearchSelect
                  label="Customer"
                  required
                  value={customer ?? null}
                  loadOptions={loadCustomers}
                  describe={directoryDescription}
                  onChange={
                    /** Keep the sample destination attached to its actual chosen identity. */ (
                      entry,
                    ) => {
                      if (entry) {
                        setCustomerId(entry.id);
                        setAddressId(entry.addresses[0]?.id ?? "");
                      }
                    }
                  }
                />
                <Button
                  variant="ghost"
                  onClick={
                    /** Create a sample identity without leaving this draft. */ () =>
                      setCustomerOpen(true)
                  }
                >
                  <Plus size={15} /> New customer
                </Button>
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
                  <SearchSelect
                    label="Weekly batch"
                    required
                    value={
                      state.batches.find(
                        /** Resolve only a sample week. */ (entry) =>
                          entry.id === batchId,
                      ) ?? null
                    }
                    loadOptions={loadBatches}
                    describe={directoryDescription}
                    onChange={
                      /** Apply an explicitly chosen intake week. */ (
                        entry,
                      ) => {
                        if (entry) setBatchId(entry.id);
                      }
                    }
                  />
                  <SearchSelect
                    label="Seller"
                    required
                    value={seller ?? null}
                    loadOptions={loadSellers}
                    describe={directoryDescription}
                    onChange={
                      /** Restore defaults after an actual choice. */ (
                        entry,
                      ) => {
                        if (entry) chooseSeller(entry.id);
                      }
                    }
                  />
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
                      setFee(String(seller.fee / 100));
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
                        <option value="included">
                          Included in quoted total
                        </option>
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
                    <span className="payment-method-symbol gcash-symbol">
                      G
                    </span>
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
          <footer className="dialog-footer parcel-entry-actions">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              name="intent"
              value="another"
              variant="secondary"
            >
              <Plus size={16} />
              Save & add another
            </Button>
            <Button type="submit" name="intent" value="save">
              <Check size={17} />
              Save parcel
            </Button>
          </footer>
        </form>
      </div>
      <CustomerDialog
        open={customerOpen}
        onClose={() => setCustomerOpen(false)}
        onSaved={
          /** Apply only the created demo customer. */ (selected) => {
            setCustomerId(selected.id);
            setAddressId(selected.addresses[0].id);
          }
        }
      />
      {sellerOpen && (
        <SellerDialog
          onClose={() => setSellerOpen(false)}
          onSaved={(entry) => {
            setSellerId(entry.id);
            setMode(entry.mode);
            setFee(String(entry.fee / 100));
            setOverride(false);
          }}
        />
      )}
    </Modal>
  );
}
