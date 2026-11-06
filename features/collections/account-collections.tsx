"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Info,
  Plus,
  RefreshCw,
  Search,
  Wallet,
} from "lucide-react";
import { useActions } from "@/components/providers";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  LinkButton,
  PageHeading,
} from "@/components/ui";
import { Pagination, PaginationEntries } from "@/components/pagination";
import {
  collectionPath,
  remittanceDetailPath,
  errorMessage,
  type ApiCollection,
  type ApiRemittance,
  type ApiSellerBalance,
  type CollectionFilters,
  type CollectionPage,
  type CollectionSummary,
  type CollectionView,
} from "@/lib/api";
import { formatDate, money } from "@/lib/prototype/domain";
import {
  AccountRemittanceDialog,
  RemittanceDetail,
} from "./account-remittance-dialog";
import { useRecovery } from "@/features/settings/account-recovery";

/** Displays only the verified rider's actual receipt and seller-share ledger. */
export function AccountCollections({
  remittanceId = null,
}: {
  remittanceId?: number | null;
}) {
  const { notify } = useActions();
  const router = useRouter();
  const params = useSearchParams();
  const { confirmedRevision } = useRecovery();
  const [view, setView] = useState<CollectionView>(
    remittanceId === null ? "receipts" : "remittances",
  );
  const [summary, setSummary] = useState<CollectionSummary | null>(null);
  const [revision, setRevision] = useState(0);
  const [handover, setHandover] = useState<ApiSellerBalance | "new" | null>(
    null,
  );
  const detail = remittanceId;

  /** Keep the visible handover and shareable URL aligned without remounting history filters. */
  function showDetail(id: number | null) {
    setView("remittances");
    router.replace(remittanceDetailPath(params.toString(), id), {
      scroll: false,
    });
  }

  /** Reloads the current ledger without changing its search or page after confirmed persistence. */
  function saved(record: ApiRemittance) {
    setHandover(null);
    setSummary(null);
    setRevision(
      /** Invalidate a pre-save ledger read. */ (current) => current + 1,
    );
    showDetail(record.id);
    notify(
      `${record.code} recorded. Seller balance updated; retained fees stay unchanged.`,
    );
  }

  const common = {
    revision: revision + confirmedRevision,
    onSummary: setSummary,
  };
  return (
    <>
      <PageHeading
        eyebrow="COLLECT CLEARLY. SETTLE CONFIDENTLY."
        title="Collections & remittances"
        description="Actual recorded receipts, retained rider fees and each seller’s net share."
      >
        <Button
          disabled={!summary?.outstanding}
          onClick={
            /** Start with searchable outstanding sellers. */ () =>
              setHandover("new")
          }
        >
          <Plus size={17} /> Record remittance
        </Button>
      </PageHeading>
      <p className="text-muted">
        All-time account totals. Search and filters apply to the records below.
      </p>
      <div className="metrics">
        {[
          {
            label: "Recorded cash",
            value: summary?.cash,
            icon: Wallet,
            tone: "sage",
          },
          {
            label: "Recorded GCash",
            value: summary?.gcash,
            icon: ArrowDownLeft,
            tone: "blue",
          },
          {
            label: "Rider fees retained",
            value: summary?.fees,
            icon: ArrowUpRight,
            tone: "peach",
          },
          {
            label: "Seller share outstanding",
            value: summary?.outstanding,
            icon: Wallet,
            tone: "purple",
          },
        ].map(
          /** Keep recorded inflows, earnings and seller debt visibly separate. */ ({
            label,
            value,
            icon: Icon,
            tone,
          }) => (
            <div className="metric-card" key={label}>
              <div>
                <p>{label}</p>
                <span className={`metric-icon avatar-${tone}`}>
                  <Icon size={19} />
                </span>
              </div>
              <strong>{value === undefined ? "—" : money(value)}</strong>
              <small>Recorded in your rider account</small>
            </div>
          ),
        )}
      </div>
      <div className="notice notice-blue collection-notice">
        <Info size={18} />
        <p>
          GCash collections and seller transfers happen outside Hatid. These are
          rider-confirmed records, not a live wallet or physical cash balance.
        </p>
      </div>
      <div className="tabs" aria-label="Collection records">
        {(
          [
            ["receipts", "Collection receipts"],
            ["sellers", "Seller balances"],
            ["remittances", "Remittance history"],
          ] as const
        ).map(
          /** Load only the selected ledger section to keep account requests small. */ ([
            kind,
            label,
          ]) => (
            <button
              key={kind}
              className={view === kind ? "tab-active" : ""}
              aria-pressed={view === kind}
              onClick={
                /** Select a ledger with its own fresh filters. */ () =>
                  setView(kind)
              }
            >
              {label}
            </button>
          ),
        )}
      </div>
      {view === "receipts" && (
        <LedgerSection<ApiCollection>
          key="receipts"
          kind="receipts"
          {...common}
        >
          {
            /** Receipt values come from the original confirmed parcel record. */ (
              rows,
            ) => (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Receipt / customer</th>
                    <th>Seller</th>
                    <th>Received</th>
                    <th>Rider fee</th>
                    <th>Seller share</th>
                    <th>Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(
                    /** Each row represents one received parcel, never a second collection. */ (
                      parcel,
                    ) => (
                      <tr key={parcel.id}>
                        <td>
                          <LinkButton
                            href={`/deliveries/${parcel.id}`}
                            variant="ghost"
                          >
                            {parcel.reference}
                          </LinkButton>
                          <strong>{parcel.customer.name}</strong>
                          <small>
                            {formatDate(parcel.receipt.confirmed_at)} ·{" "}
                            {parcel.receipt.method === "cash"
                              ? "COD cash"
                              : "GCash · rider confirmed"}
                          </small>
                        </td>
                        <td>
                          {parcel.seller.name}
                          <small>{parcel.batch.name}</small>
                        </td>
                        <td>{money(parcel.receipt.amount)}</td>
                        <td>{money(parcel.pricing.fee)}</td>
                        <td>{money(parcel.pricing.sellerShare)}</td>
                        <td>{money(parcel.settlement.outstanding)}</td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            )
          }
        </LedgerSection>
      )}
      {view === "sellers" && (
        <LedgerSection<ApiSellerBalance>
          key="sellers"
          kind="sellers"
          {...common}
        >
          {
            /** Saved fee defaults never replace the actual historical seller share. */ (
              rows,
            ) => (
              <div className="seller-balance-grid card-body">
                {rows.map(
                  /** Archived sellers remain payable when money is still owed. */ (
                    seller,
                  ) => (
                    <section
                      className="card seller-balance-card"
                      key={seller.id}
                    >
                      <div>
                        <Avatar name={seller.name} />
                        <span>
                          <strong>{seller.name}</strong>
                          <small>
                            {seller.archived_at
                              ? "Archived seller · history retained"
                              : `${seller.balance.receipts} recorded receipt(s)`}
                          </small>
                        </span>
                        <Badge
                          tone={
                            seller.balance.outstanding > 0 ? "amber" : "green"
                          }
                        >
                          {seller.balance.outstanding > 0
                            ? "To remit"
                            : "Nothing due"}
                        </Badge>
                      </div>
                      <strong>{money(seller.balance.outstanding)}</strong>
                      <small>Outstanding seller share</small>
                      <div className="seller-directory-stats">
                        <span>
                          Seller share accrued
                          <strong>{money(seller.balance.accrued)}</strong>
                        </span>
                        <span>
                          Handovers recorded
                          <strong>{money(seller.balance.remitted)}</strong>
                        </span>
                        <span>
                          Rider fees retained
                          <strong>{money(seller.balance.fees)}</strong>
                        </span>
                      </div>
                      <Button
                        variant="secondary"
                        className="button-full"
                        disabled={seller.balance.outstanding <= 0}
                        onClick={
                          /** Review a fresh balance before recording this seller's handover. */ () =>
                            setHandover(seller)
                        }
                      >
                        Record handover
                      </Button>
                    </section>
                  ),
                )}
              </div>
            )
          }
        </LedgerSection>
      )}
      {view === "remittances" && (
        <LedgerSection<ApiRemittance>
          key="remittances"
          kind="remittances"
          {...common}
        >
          {
            /** Handover method is independent of the customer's original payment method. */ (
              rows,
            ) => (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Handover</th>
                    <th>Seller</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Reference</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map(
                    /** Open immutable recorded allocations rather than an editable payment. */ (
                      record,
                    ) => (
                      <tr key={record.id}>
                        <td>
                          <strong>{record.code}</strong>
                          <small>{formatDate(record.recorded_at)}</small>
                        </td>
                        <td>
                          {record.seller.name}
                          {record.seller.archived_at && (
                            <small>Archived seller</small>
                          )}
                        </td>
                        <td>{money(record.amount)}</td>
                        <td>
                          {record.method === "cash"
                            ? "Cash handover"
                            : "External GCash"}
                        </td>
                        <td>{record.reference || "—"}</td>
                        <td>
                          <Button
                            variant="ghost"
                            aria-label={`View ${record.code}`}
                            onClick={
                              /** Read this handover's original parcel allocations. */ () =>
                                showDetail(record.id)
                            }
                          >
                            Details
                          </Button>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            )
          }
        </LedgerSection>
      )}
      {handover && (
        <AccountRemittanceDialog
          initialSeller={handover === "new" ? null : handover}
          onClose={
            /** Cancel only an unsubmitted or definitively rejected draft. */ () =>
              setHandover(null)
          }
          onSaved={saved}
        />
      )}
      {detail !== null && (
        <RemittanceDetail
          key={detail}
          id={detail}
          onClose={
            /** Close this read-only view and clear its URL target. */ () =>
              showDetail(null)
          }
        />
      )}
    </>
  );
}

/** Shares only the three ledgers' actual search/filter/pagination mechanics and lifecycle guards. */
function LedgerSection<T>({
  kind,
  revision,
  onSummary,
  children,
}: {
  kind: CollectionView;
  revision: number;
  onSummary: (summary: CollectionSummary) => void;
  children: (rows: T[]) => ReactNode;
}) {
  const { request } = useActions();
  const [filters, setFilters] = useState<
    CollectionFilters & { reload: number }
  >({
    query: "",
    method: "all",
    balance: "all",
    page: 1,
    perPage: 10,
    reload: 0,
  });
  const [page, setPage] = useState<CollectionPage<T> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadedRevision, setLoadedRevision] = useState(-1);
  const [error, setError] = useState("");
  const read = useRef(0);

  /** Invalidate pending reads immediately before changing filters, even before effect cleanup. */
  function update(values: Partial<CollectionFilters> = {}) {
    read.current++;
    setLoading(true);
    setError("");
    setFilters(
      /** Preserve unrelated filters during retries and server page corrections. */ (
        current,
      ) => ({ ...current, ...values, reload: current.reload + 1 }),
    );
  }

  /** Server pages and lifetime summary replace state only for the latest account/view read. */
  useEffect(() => {
    let active = true;
    const attempt = ++read.current;
    const controller = new AbortController();
    const timer = setTimeout(
      /** Debounce text search without loading the entire ledger. */ async () => {
        try {
          const response = await request<CollectionPage<T>>(
            collectionPath(kind, filters),
            "GET",
            undefined,
            { signal: controller.signal },
          );
          if (!active || attempt !== read.current) return;
          const last = Math.max(1, response.meta.last_page);
          if (filters.page > last) {
            update({ page: last });
            return;
          }
          setPage(response);
          setError("");
          setLoading(false);
          setLoadedRevision(revision);
          onSummary(response.summary);
        } catch (cause) {
          if (active && attempt === read.current) {
            setError(errorMessage(cause, "Unable to load your ledger."));
            setLoading(false);
            setLoadedRevision(revision);
          }
        }
      },
      filters.query ? 250 : 0,
    );
    /** Navigation, filter changes and confirmed saves invalidate/cancel older reads. */
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [request, kind, filters, revision, onSummary]);

  const busy = loading || loadedRevision !== revision;
  const controls = {
    page: page?.meta.current_page ?? filters.page,
    perPage: filters.perPage,
    total: page?.meta.total ?? 0,
    disabled: busy,
    onChange: update,
  };
  const label =
    kind === "receipts"
      ? "Collection receipts"
      : kind === "sellers"
        ? "Seller balances"
        : "Remittance history";
  return (
    <Card>
      <div className="table-toolbar">
        <div className="toolbar-filters">
          {kind === "sellers" ? (
            <select
              aria-label="Seller balance status"
              value={filters.balance}
              onChange={
                /** Balance status always starts at page one. */ (event) =>
                  update({
                    balance: event.target.value as CollectionFilters["balance"],
                    page: 1,
                  })
              }
            >
              <option value="all">All seller balances</option>
              <option value="outstanding">Outstanding only</option>
              <option value="settled">Nothing due</option>
            </select>
          ) : (
            <select
              aria-label={
                kind === "receipts" ? "Receipt method" : "Handover method"
              }
              value={filters.method}
              onChange={
                /** Filter actual recorded methods rather than expected parcel payments. */ (
                  event,
                ) =>
                  update({
                    method: event.target.value as CollectionFilters["method"],
                    page: 1,
                  })
              }
            >
              <option value="all">All methods</option>
              <option value="cash">
                {kind === "receipts" ? "COD cash" : "Cash handover"}
              </option>
              <option value="gcash">GCash · manual</option>
            </select>
          )}
          <Button
            variant="ghost"
            disabled={busy}
            onClick={
              /** Refresh without altering the selected record scope. */ () =>
                update()
            }
          >
            <RefreshCw size={16} /> Refresh
          </Button>
        </div>
      </div>
      <div className="table-toolbar">
        <PaginationEntries {...controls} label={label} />
        <div className="input-with-icon">
          <Search size={17} />
          <input
            type="search"
            aria-label={`Search ${label.toLowerCase()}`}
            placeholder={
              kind === "receipts"
                ? "Customer, seller or parcel…"
                : kind === "sellers"
                  ? "Seller name or contact…"
                  : "Seller, handover or reference…"
            }
            maxLength={100}
            value={filters.query}
            onChange={
              /** Search all matching server records from page one. */ (
                event,
              ) => update({ query: event.target.value, page: 1 })
            }
          />
        </div>
      </div>
      {busy ? (
        <div className="card-body">
          <p role="status">Loading {label.toLowerCase()}…</p>
        </div>
      ) : error ? (
        <div className="card-body form-stack">
          <p role="alert">{error}</p>
          <Button
            variant="secondary"
            onClick={
              /** Retain search inputs while retrying connectivity/server errors. */ () =>
                update()
            }
          >
            Try again
          </Button>
        </div>
      ) : !page?.data.length ? (
        <EmptyState title={`No matching ${label.toLowerCase()}`}>
          Try another filter. Collections appear after successful deliveries and
          rider-confirmed receipts.
        </EmptyState>
      ) : (
        <div className="table-scroll">{children(page.data)}</div>
      )}
      {page && !busy && !error && <Pagination {...controls} label={label} />}
    </Card>
  );
}
