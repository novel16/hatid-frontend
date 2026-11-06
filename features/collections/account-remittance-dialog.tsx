"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Check, Info, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActions } from "@/components/providers";
import { SearchSelect } from "@/components/search-select";
import { Pagination } from "@/components/pagination";
import { Button, CheckField, Field, LinkButton, Modal } from "@/components/ui";
import {
  ApiError,
  collectionPath,
  errorMessage,
  validationMessage,
  type ApiCollection,
  type ApiRemittance,
  type ApiSellerBalance,
  type CollectionPage,
  type NewRemittance,
  type PaginatedResponse,
} from "@/lib/api";
import { formatDate, money, parseMoney } from "@/lib/prototype/domain";
import type { PaymentMethod } from "@/lib/prototype/types";
import { useRecovery } from "@/features/settings/account-recovery";
import {
  RecoveryFailure,
  recoveryLocked,
  type RecoveryEntry,
} from "@/lib/recovery";

/** Records a completed external handover with one immutable operation during ambiguous retries. */
export function AccountRemittanceDialog({
  initialSeller,
  onClose,
  onSaved,
}: {
  initialSeller: ApiSellerBalance | null;
  onClose: () => void;
  onSaved: (record: ApiRemittance) => void;
}) {
  const { request, notify } = useActions();
  const router = useRouter();
  const { create, send, check } = useRecovery();
  const recoveryEntry = useRef<RecoveryEntry | null>(null);
  const active = useRef(true);
  const [seller, setSeller] = useState(initialSeller);
  const [amount, setAmount] = useState(
    initialSeller ? String(initialSeller.balance.outstanding / 100) : "",
  );
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [reference, setReference] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [checking, setChecking] = useState(!!initialSeller);
  const [verified, setVerified] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [saving, setSaving] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState("");
  const snapshot = useRef<NewRemittance | null>(null);
  const inFlight = useRef(false);
  const amountEdited = useRef(false);
  const balanceRead = useRef(0);
  const sellerId = seller?.id;
  /** A closed/account-replaced form cannot update a later view. */
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  /** Search owed sellers, including archived identities, using ten-record API pages. */
  const loadSellers = useCallback(
    (query: string, page: number, signal: AbortSignal) =>
      request<CollectionPage<ApiSellerBalance>>(
        collectionPath("sellers", {
          query,
          page,
          perPage: 10,
          method: "all",
          balance: "outstanding",
        }),
        "GET",
        undefined,
        { signal },
      ),
    [request],
  );

  /** A selected card may be stale; confirm its current owned balance before enabling a handover. */
  useEffect(() => {
    if (!sellerId) return;
    const attempt = ++balanceRead.current;
    let active = true;
    const controller = new AbortController();
    /** Recheck only the selected seller; never download or scan a complete directory. */
    async function load() {
      try {
        const response = await request<CollectionPage<ApiSellerBalance>>(
          `/collections/sellers?seller_id=${sellerId}&per_page=10`,
          "GET",
          undefined,
          { signal: controller.signal },
        );
        if (!active || attempt !== balanceRead.current) return;
        const current = response.data.find(
          /** Accept only the requested owned identity. */ (record) =>
            record.id === sellerId,
        );
        if (!current)
          throw new Error(
            "This seller's balance is unavailable. Refresh and try again.",
          );
        setSeller(current);
        if (!amountEdited.current)
          setAmount(String(current.balance.outstanding / 100));
        setVerified(true);
        setChecking(false);
      } catch (cause) {
        if (active && attempt === balanceRead.current) {
          setError(errorMessage(cause));
          setChecking(false);
        }
      }
    }
    void load();
    /** Closing or changing the selection invalidates its balance response. */
    return () => {
      active = false;
      controller.abort();
    };
  }, [request, sellerId, refresh]);

  /** A new identity clears confirmation and the old amount before its balance is checked. */
  function chooseSeller(record: ApiSellerBalance | null) {
    balanceRead.current++;
    setSeller(record);
    setAmount("");
    amountEdited.current = false;
    setConfirmed(false);
    setVerified(false);
    setChecking(!!record);
    setError("");
    setReference("");
    setRefresh(
      /** Rechecking the same identity must still complete its balance loading state. */
      (current) => current + 1,
    );
  }

  /** Preserve the amount actually entered while revalidating a changed balance after a rejection. */
  function refreshBalance() {
    balanceRead.current++;
    setChecking(true);
    setVerified(false);
    setConfirmed(false);
    setError("");
    setRefresh(/** Trigger one fresh server read. */ (current) => current + 1);
  }

  /** Durable unresolved evidence stays available after closing this form. */
  function close() {
    if (!saving) onClose();
  }

  /** Retrying an interrupted success sends the exact same amount, seller, reference and UUID. */
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || inFlight.current || checking) return;
    inFlight.current = true;
    try {
      if (!snapshot.current) {
        if (!seller || !verified || !confirmed)
          throw new Error(
            "Choose a seller and confirm the completed handover first.",
          );
        const value = parseMoney(amount);
        if (value <= 0 || value > seller.balance.outstanding)
          throw new Error(
            "Enter a positive amount within this seller's outstanding share.",
          );
        amountEdited.current = true;
        snapshot.current = {
          operation_id: crypto.randomUUID(),
          seller_id: seller.id,
          amount: value,
          method,
          reference: reference.trim(),
          handover_confirmed: true,
        };
      }
      setSaving(true);
      setError("");
      const values = snapshot.current;
      recoveryEntry.current ??= create("remittance");
      const observed = uncertain ? await check(recoveryEntry.current) : null;
      if (uncertain && observed?.state !== "confirmed") {
        const response = await request<CollectionPage<ApiSellerBalance>>(
          `/collections/sellers?seller_id=${values.seller_id}&per_page=10`,
        );
        const current = response.data.find(
          /** A retry uses only the original seller and fresh server share. */ (
            record,
          ) => record.id === values.seller_id,
        );
        if (!current || current.balance.outstanding < values.amount)
          throw new Error(
            "The original amount exceeds the current seller share. Keep this evidence and review it in recovery.",
          );
      }
      if (!active.current) return;
      const result =
        observed?.state === "confirmed"
          ? { entry: observed.entry, response: null }
          : await send(observed?.entry ?? recoveryEntry.current, {
              kind: "remittance",
              values,
            });
      recoveryEntry.current = result.entry;
      if (!active.current) return;
      const data = (result.response as { data?: ApiRemittance } | null)?.data;
      snapshot.current = null;
      setUncertain(false);
      if (
        data &&
        Number.isSafeInteger(data.id) &&
        data.id === result.entry.target!.id &&
        data.code &&
        data.amount === values.amount &&
        data.method === values.method &&
        data.seller?.id === values.seller_id
      )
        onSaved(data);
      else {
        notify(
          "Original seller handover confirmed. Open the saved record to review it.",
        );
        onClose();
        router.push(`/collections?remittance=${result.entry.target!.id}`);
      }
    } catch (cause) {
      if (!active.current) return;
      if (cause instanceof RecoveryFailure && cause.entry)
        recoveryEntry.current = cause.entry;
      const underlying = cause instanceof RecoveryFailure ? cause.cause : cause;
      const locked = recoveryEntry.current
        ? recoveryLocked(recoveryEntry.current)
        : false;
      if (locked) {
        setUncertain(true);
        setError(
          `${validationMessage(underlying)} The original handover is preserved in Drafts & recovery. Do not hand over the money again.`,
        );
      } else {
        snapshot.current = null;
        setUncertain(false);
        setConfirmed(false);
        setError(validationMessage(underlying));
        if (underlying instanceof ApiError && underlying.status === 422)
          setVerified(false);
      }
    } finally {
      inFlight.current = false;
      if (active.current) setSaving(false);
    }
  }

  const locked = saving || uncertain;
  return (
    <Modal
      open
      onClose={close}
      closeDisabled={saving}
      title="Record a seller handover"
      description="Complete the actual handover first. Hatid records it and transfers no money."
    >
      <form method="post" onSubmit={submit}>
        <div className="dialog-body form-stack">
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          {uncertain && (
            <LinkButton href="/sync" variant="secondary" onClick={onClose}>
              Open recovery
            </LinkButton>
          )}
          {!verified && seller && !checking && !locked && (
            <Button variant="secondary" onClick={refreshBalance}>
              <RefreshCw size={15} /> Refresh balance
            </Button>
          )}
          <fieldset
            className="form-stack form-fieldset"
            disabled={locked || checking}
          >
            <SearchSelect
              label="Seller"
              value={seller}
              onChange={chooseSeller}
              loadOptions={loadSellers}
              describe={
                /** Show the payable amount without implying a live wallet balance. */ (
                  record,
                ) =>
                  `${money(record.balance.outstanding)} outstanding${record.archived_at ? " · archived seller" : ""}`
              }
              required
            />
            <div className="remit-balance">
              <span>Net seller share outstanding</span>
              <strong>
                {checking
                  ? "Checking…"
                  : verified && seller
                    ? money(seller.balance.outstanding)
                    : "—"}
              </strong>
            </div>
            <p className="text-muted">
              Oldest confirmed seller shares are paid first. Rider fees are
              retained separately.
            </p>
            <Field
              label="Amount actually handed over"
              required
              hint="Partial handovers leave the remaining seller share outstanding."
            >
              <div className="currency-input">
                <span>₱</span>
                <input
                  type="number"
                  min="0.01"
                  max={
                    verified && seller
                      ? seller.balance.outstanding / 100
                      : undefined
                  }
                  step="0.01"
                  required
                  value={amount}
                  disabled={checking || !seller}
                  onChange={
                    /** Never silently change a human-entered handover amount. */ (
                      event,
                    ) => {
                      amountEdited.current = true;
                      setAmount(event.target.value);
                      setConfirmed(false);
                    }
                  }
                />
              </div>
            </Field>
            <Field label="Handover method">
              <select
                value={method}
                onChange={
                  /** Changing the method requires a fresh explicit acknowledgement. */ (
                    event,
                  ) => {
                    setMethod(event.target.value as PaymentMethod);
                    setConfirmed(false);
                  }
                }
              >
                <option value="cash">Cash handover</option>
                <option value="gcash">GCash · completed outside Hatid</option>
              </select>
            </Field>
            <Field label="Reference / note (optional)">
              <input
                maxLength={200}
                value={reference}
                onChange={
                  /** References are evidence text, never automatic verification. */ (
                    event,
                  ) => {
                    setReference(event.target.value);
                    setConfirmed(false);
                  }
                }
                placeholder="Seller acknowledgement or external reference"
              />
            </Field>
            <div className="notice notice-muted">
              <Info size={18} />
              <p>
                {method === "gcash"
                  ? "Complete the transfer in your own GCash app and confirm the seller received it. A reference does not verify payment."
                  : "Record only cash physically handed to this seller."}
              </p>
            </div>
            <CheckField checked={confirmed} onChange={setConfirmed}>
              {method === "gcash"
                ? "I completed the external GCash transfer and confirmed the seller received this amount."
                : "I physically handed this amount to the seller."}
            </CheckField>
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
              checking ||
              (!uncertain &&
                (!confirmed ||
                  !verified ||
                  !seller ||
                  seller.balance.outstanding <= 0))
            }
          >
            <Check size={16} />
            {saving
              ? "Saving…"
              : uncertain
                ? "Retry same handover"
                : "Confirm handover"}
          </Button>
        </footer>
      </form>
    </Modal>
  );
}

/** Reads immutable handover allocations with compact pagination and parent-modal scrolling. */
export function RemittanceDetail({
  id,
  onClose,
}: {
  id: number;
  onClose: () => void;
}) {
  const { request } = useActions();
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<
    (PaginatedResponse<ApiCollection> & { remittance: ApiRemittance }) | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /** Ignore responses for a closed detail or an older allocation page. */
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    /** Fetch one owned allocation page; never load an entire handover into a modal. */
    async function load() {
      try {
        const response = await request<
          PaginatedResponse<ApiCollection> & { remittance: ApiRemittance }
        >(`/remittances/${id}?page=${page}`, "GET", undefined, {
          signal: controller.signal,
        });
        if (active) {
          setResult(response);
          setLoading(false);
        }
      } catch (cause) {
        if (active) {
          setError(errorMessage(cause));
          setLoading(false);
        }
      }
    }
    void load();
    /** Dismissal cancels the read without altering recorded money. */
    return () => {
      active = false;
      controller.abort();
    };
  }, [request, id, page, revision]);

  /** Start a retry or page change without leaving stale rows actionable. */
  function reload(nextPage = page) {
    setLoading(true);
    setError("");
    setPage(nextPage);
    setRevision(
      /** Permit retrying the same failed page. */ (current) => current + 1,
    );
  }

  const record = result?.remittance;
  return (
    <Modal
      open
      onClose={onClose}
      title={record?.code ?? "Handover details"}
      description="Recorded seller-share allocations. This view cannot change a payment."
    >
      <div className="dialog-body form-stack">
        {loading ? (
          <p role="status">Loading handover details…</p>
        ) : error ? (
          <>
            <p role="alert" className="form-error">
              {error}
            </p>
            <Button
              variant="secondary"
              onClick={/** Retry the existing read-only page. */ () => reload()}
            >
              Try again
            </Button>
          </>
        ) : (
          record &&
          result && (
            <>
              <div className="remit-balance">
                <span>{record.seller.name}</span>
                <strong>{money(record.amount)}</strong>
              </div>
              <p>
                {record.method === "cash"
                  ? "Cash handover"
                  : "GCash completed outside Hatid"}{" "}
                · {formatDate(record.recorded_at)}
              </p>
              <p>Reference: {record.reference || "Not provided"}</p>
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Parcel / customer</th>
                      <th>Intake batch</th>
                      <th>Allocated seller share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.map(
                      /** Keep the original allocation amount distinct from today's outstanding balance. */ (
                        parcel,
                      ) => (
                        <tr key={parcel.id}>
                          <td>
                            <strong>{parcel.reference}</strong>
                            <small>{parcel.customer.name}</small>
                          </td>
                          <td>{parcel.batch.name}</td>
                          <td>{money(parcel.allocated_amount ?? 0)}</td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
              <Pagination
                compact
                page={result.meta.current_page}
                perPage={10}
                total={result.meta.total}
                label="Handover allocations"
                onChange={
                  /** Read the requested fixed-size page. */ ({ page: next }) =>
                    reload(next)
                }
              />
            </>
          )
        )}
      </div>
      <footer className="dialog-footer">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </footer>
    </Modal>
  );
}
