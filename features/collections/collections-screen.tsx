"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  Download,
  Info,
  Plus,
  Wallet,
} from "lucide-react";
import { usePrototypeState } from "@/lib/prototype/store";
import {
  formatDate,
  money,
  parseMoney,
  recordRemittance,
  sellerBalance,
  totals,
} from "@/lib/prototype/domain";
import type { PaymentMethod, Remittance } from "@/lib/prototype/types";
import { useActions } from "@/components/providers";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CheckField,
  EmptyState,
  Field,
  Modal,
  PageHeading,
  exportCsv,
} from "@/components/ui";
import {
  Pagination,
  PaginationEntries,
  usePagination,
} from "@/components/pagination";

/** Keeps each money-record list independently paginated without changing aggregate amounts. */
export function CollectionsScreen() {
  const state = usePrototypeState();
  const { notify } = useActions();
  const [tab, setTab] = useState("collections");
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Remittance | null>(null);
  const summary = totals(state);
  const collected = state.parcels
    .filter((parcel) => parcel.status === "delivered" && parcel.receipt)
    .sort((a, b) =>
      (b.receipt?.confirmedAt ?? "").localeCompare(
        a.receipt?.confirmedAt ?? "",
      ),
    );
  const firstOwed = state.sellers.find(
    (seller) => sellerBalance(state, seller.id) > 0,
  );
  const collections = usePagination(collected);
  const remittances = usePagination(state.remittances);
  const sellers = usePagination(state.sellers);
  const recordPagination = tab === "collections" ? collections : remittances;
  const recordPaginationLabel =
    tab === "collections"
      ? "Collection records pagination"
      : "Remittance history pagination";
  return (
    <>
      <PageHeading
        eyebrow="COLLECT CLEARLY. SETTLE CONFIDENTLY."
        title="Collections & remittances"
        description="Recorded receipts, your retained fees, and each seller’s net share."
      >
        <Button
          variant="secondary"
          onClick={() => {
            exportCsv("hatid-collections.csv", [
              [
                "Parcel",
                "Seller",
                "Method",
                "Received PHP",
                "Rider fee PHP",
                "Seller share PHP",
              ],
              ...collected.map((parcel) => [
                parcel.reference,
                state.sellers.find((seller) => seller.id === parcel.sellerId)
                  ?.name ?? "",
                parcel.receipt?.method ?? "",
                parcel.pricing.total / 100,
                parcel.pricing.fee / 100,
                parcel.pricing.sellerShare / 100,
              ]),
            ]);
            notify("Collection report downloaded.");
          }}
        >
          <Download size={16} />
          Export
        </Button>
        <Button
          disabled={!firstOwed || state.offline}
          onClick={() => firstOwed && setSellerId(firstOwed.id)}
        >
          <Plus size={17} />
          Record remittance
        </Button>
      </PageHeading>
      <div className="metrics">
        {[
          {
            label: "Recorded cash",
            value: summary.cash,
            icon: Wallet,
            tone: "sage",
          },
          {
            label: "Recorded GCash",
            value: summary.gcash,
            icon: ArrowDownLeft,
            tone: "blue",
          },
          {
            label: "Rider fees retained",
            value: summary.fees,
            icon: ArrowUpRight,
            tone: "peach",
          },
          {
            label: "Seller share outstanding",
            value: summary.outstanding,
            icon: Wallet,
            tone: "purple",
          },
        ].map(({ label, value, icon: Icon, tone }) => (
          <div className="metric-card" key={label}>
            <div>
              <p>{label}</p>
              <span className={`metric-icon avatar-${tone}`}>
                <Icon size={18} />
              </span>
            </div>
            <strong>{money(value)}</strong>
            <small>
              {label === "Recorded GCash"
                ? "Manually confirmed by rider"
                : label === "Seller share outstanding"
                  ? "Net of your delivery fees"
                  : label === "Rider fees retained"
                    ? "Counted once, at delivery"
                    : "Recorded inflows, not a cash count"}
            </small>
          </div>
        ))}
      </div>
      <div className="notice notice-blue collection-notice">
        <Info size={18} />
        <p>
          GCash transactions happen in your own account, outside Hatid. These
          are receipt records, not a live wallet balance.
        </p>
      </div>
      <section className="seller-balances">
        <div className="section-title">
          <h2>What’s due to your sellers</h2>
          <span>Net seller share only</span>
        </div>
        <div className="directory-toolbar">
          <PaginationEntries
            {...sellers.controls}
            label="Seller balances pagination"
          />
        </div>
        <div className="seller-balance-grid">
          {sellers.items.map((seller) => {
            const balance = sellerBalance(state, seller.id);
            return (
              <div className="card seller-balance-card" key={seller.id}>
                <div>
                  <Avatar name={seller.name} color={seller.color} />
                  <span>
                    <strong>{seller.name}</strong>
                    <small>Fee {seller.mode}</small>
                  </span>
                  <Badge tone={balance ? "amber" : "green"}>
                    {balance ? "To remit" : "Settled"}
                  </Badge>
                </div>
                <strong>{money(balance)}</strong>
                <small>Outstanding seller share</small>
                <Button
                  variant="secondary"
                  className="button-full"
                  disabled={balance === 0 || state.offline}
                  onClick={() => setSellerId(seller.id)}
                >
                  Record handover
                  <ArrowRight size={15} />
                </Button>
              </div>
            );
          })}
        </div>
        <Pagination {...sellers.controls} label="Seller balances pagination" />
      </section>
      <Card>
        <div className="tabs">
          <button
            className={tab === "collections" ? "tab-active" : ""}
            onClick={() => setTab("collections")}
          >
            Collection records<span>{collected.length}</span>
          </button>
          <button
            className={tab === "remittances" ? "tab-active" : ""}
            onClick={() => setTab("remittances")}
          >
            Remittance history<span>{state.remittances.length}</span>
          </button>
        </div>
        <div className="table-toolbar">
          <PaginationEntries
            {...recordPagination.controls}
            label={recordPaginationLabel}
          />
        </div>
        {tab === "collections" ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Parcel / customer</th>
                  <th>Seller</th>
                  <th>Received</th>
                  <th>Method</th>
                  <th>Your fee</th>
                  <th>Confirmation</th>
                </tr>
              </thead>
              <tbody>
                {collections.items.map((parcel) => (
                  <tr key={parcel.id}>
                    <td>
                      <Link
                        className="table-primary"
                        href={`/deliveries/${parcel.id}`}
                      >
                        <strong>{parcel.reference}</strong>
                        <small>
                          {
                            state.customers.find(
                              (customer) => customer.id === parcel.customerId,
                            )?.name
                          }
                        </small>
                      </Link>
                    </td>
                    <td>
                      {
                        state.sellers.find(
                          (seller) => seller.id === parcel.sellerId,
                        )?.name
                      }
                    </td>
                    <td className="money-cell">
                      {money(parcel.receipt?.amount ?? 0)}
                    </td>
                    <td>
                      <Badge
                        tone={
                          parcel.receipt?.method === "gcash" ? "blue" : "gray"
                        }
                      >
                        {parcel.receipt?.method === "gcash" ? "GCash" : "Cash"}
                      </Badge>
                    </td>
                    <td className="money-cell text-green">
                      {money(parcel.pricing.fee)}
                    </td>
                    <td>
                      <span className="receipt-confirmed">
                        <Check size={13} />
                        Rider confirmed
                      </span>
                      <small className="cell-subtext">
                        {formatDate(
                          parcel.receipt?.confirmedAt ?? "2026-11-01",
                          true,
                        )}
                      </small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!collected.length && (
              <EmptyState title="No receipts recorded">
                Confirm delivery and payment to start your collection records.
              </EmptyState>
            )}
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Seller</th>
                  <th>Handover</th>
                  <th>Method</th>
                  <th>Recorded at</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {remittances.items.map((remit) => (
                  <tr key={remit.id}>
                    <td>
                      <strong>
                        {
                          state.sellers.find(
                            (seller) => seller.id === remit.sellerId,
                          )?.name
                        }
                      </strong>
                      <small className="cell-subtext">
                        {remit.reference || "Handover confirmed"}
                      </small>
                    </td>
                    <td className="money-cell">{money(remit.amount)}</td>
                    <td>
                      <Badge tone={remit.method === "gcash" ? "blue" : "gray"}>
                        {remit.method === "gcash" ? "External GCash" : "Cash"}
                      </Badge>
                    </td>
                    <td>{formatDate(remit.at, true)}</td>
                    <td>
                      <Badge tone="green">Recorded</Badge>
                    </td>
                    <td>
                      <button
                        className="text-link"
                        onClick={() => setDetail(remit)}
                      >
                        View
                        <ArrowRight size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!state.remittances.length && (
              <EmptyState title="No remittances yet">
                Record a handover after you complete it outside the app.
              </EmptyState>
            )}
          </div>
        )}
        <Pagination
          {...recordPagination.controls}
          label={recordPaginationLabel}
        />
        <div className="card-table-footer">
          <span>Delivery fees are retained, not remitted again.</span>
          <Badge tone="green">Clear money records</Badge>
        </div>
      </Card>
      {sellerId && (
        <RemittanceDialog
          sellerId={sellerId}
          onClose={() => setSellerId(null)}
        />
      )}
      {detail && (
        <Modal
          open
          onClose={() => setDetail(null)}
          title="Remittance record"
          description={
            state.sellers.find((seller) => seller.id === detail.sellerId)?.name
          }
        >
          <div className="dialog-body form-stack">
            <div className="handover-total">
              <span>Recorded handover</span>
              <strong>{money(detail.amount)}</strong>
              <small>
                {detail.method === "gcash"
                  ? "External GCash · rider confirmed"
                  : "Cash handover · rider confirmed"}
              </small>
            </div>
            <div className="record-details">
              <span>
                Recorded at<strong>{formatDate(detail.at, true)}</strong>
              </span>
              <span>
                Reference / note<strong>{detail.reference || "—"}</strong>
              </span>
              {detail.allocations.map((allocation) => (
                <span key={allocation.parcelId}>
                  {
                    state.parcels.find(
                      (parcel) => parcel.id === allocation.parcelId,
                    )?.reference
                  }
                  <strong>{money(allocation.amount)}</strong>
                </span>
              ))}
              <span>
                Current seller balance
                <strong>{money(sellerBalance(state, detail.sellerId))}</strong>
              </span>
            </div>
            <div className="notice">
              <Check size={17} />
              <p>
                This allocates the seller’s share only. Your earned delivery
                fees stay unchanged.
              </p>
            </div>
          </div>
          <footer className="dialog-footer">
            <Button onClick={() => setDetail(null)}>Done</Button>
          </footer>
        </Modal>
      )}
    </>
  );
}

function RemittanceDialog({
  sellerId: initialSeller,
  onClose,
}: {
  sellerId: string;
  onClose: () => void;
}) {
  const state = usePrototypeState();
  const { commit, notify } = useActions();
  const [sellerId, setSellerId] = useState(initialSeller);
  const [amount, setAmount] = useState(
    String(sellerBalance(state, initialSeller) / 100),
  );
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [confirmed, setConfirmed] = useState(false);
  const balance = sellerBalance(state, sellerId);
  return (
    <Modal
      open
      onClose={onClose}
      title="Record a seller handover"
      description="Complete the actual handover first. Hatid only records it."
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!confirmed || state.offline) return;
          const data = new FormData(event.currentTarget);
          try {
            const value = parseMoney(amount);
            if (
              commit(
                (current) =>
                  recordRemittance(current, {
                    id: crypto.randomUUID(),
                    sellerId,
                    amount: value,
                    method,
                    reference: String(data.get("reference")).trim(),
                    at: new Date().toISOString(),
                  }),
                "Seller handover recorded. Remaining balance updated.",
              )
            )
              onClose();
          } catch (error) {
            notify(
              error instanceof Error ? error.message : "Review the amount.",
              true,
            );
          }
        }}
      >
        <div className="dialog-body form-stack">
          <Field label="Seller" required>
            <select
              value={sellerId}
              onChange={(event) => {
                setSellerId(event.target.value);
                setAmount(
                  String(sellerBalance(state, event.target.value) / 100),
                );
                setConfirmed(false);
              }}
            >
              {state.sellers.map((seller) => (
                <option key={seller.id} value={seller.id}>
                  {seller.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="remit-balance">
            <span>Net seller share outstanding</span>
            <strong>{money(balance)}</strong>
          </div>
          <Field
            label="Amount actually handed over"
            required
            hint="A partial handover keeps the remaining balance outstanding."
          >
            <div className="currency-input">
              <span>₱</span>
              <input
                type="number"
                required
                min="0.01"
                max={balance / 100}
                step="0.01"
                value={amount}
                onChange={(event) => {
                  setAmount(event.target.value);
                  setConfirmed(false);
                }}
              />
            </div>
          </Field>
          <Field label="Handover method">
            <select
              value={method}
              onChange={(event) => {
                setMethod(event.target.value as PaymentMethod);
                setConfirmed(false);
              }}
            >
              <option value="cash">Cash handover</option>
              <option value="gcash">GCash — completed outside Hatid</option>
            </select>
          </Field>
          <Field label="Reference / note (optional)">
            <input
              name="reference"
              maxLength={200}
              placeholder="Seller acknowledgement or external reference"
            />
          </Field>
          <div className="notice notice-muted">
            <Info size={18} />
            <p>
              {method === "gcash"
                ? "Complete the GCash transfer in your own app. A reference alone does not verify a payment."
                : "Only record the cash you physically handed to the seller."}
            </p>
          </div>
          <CheckField checked={confirmed} onChange={setConfirmed}>
            {method === "gcash"
              ? "I completed the external GCash transfer and confirmed the seller received it."
              : "I physically handed this amount to the seller."}
          </CheckField>
        </div>
        <footer className="dialog-footer">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!confirmed || state.offline}>
            <Check size={16} />
            Confirm handover
          </Button>
        </footer>
      </form>
    </Modal>
  );
}
