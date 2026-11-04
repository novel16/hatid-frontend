"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, Plus, Search } from "lucide-react";
import { useActions } from "@/components/providers";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeading,
  StatusBadge,
} from "@/components/ui";
import { Pagination, PaginationEntries } from "@/components/pagination";
import type { PaginationState } from "@/lib/pagination";
import {
  ApiError,
  errorMessage,
  type ApiBatch,
  type ApiDelivery,
  type PaginatedResponse,
} from "@/lib/api";
import { money } from "@/lib/prototype/domain";
import { ParcelDirectorySelect } from "@/features/parcels/parcel-directory";
import {
  AddParcelButton,
  useParcelEntry,
} from "@/features/parcels/parcel-entry-screen";

/** Lists matching physical stops across intake weeks using the API's native pagination. */
export function AccountDeliveriesScreen({
  batchId,
  initialSearch = "",
  embedded = false,
  onChoose,
}: {
  batchId?: string;
  initialSearch?: string;
  embedded?: boolean;
  onChoose?: (stop: ApiDelivery) => void;
}) {
  const { request } = useActions();
  const { revision: parcelRevision } = useParcelEntry();
  const selecting = !!onChoose;
  const [query, setQuery] = useState<
    PaginationState & {
      search: string;
      status: string;
      method: string;
      revision: number;
    }
  >({
    page: 1,
    perPage: 10,
    search: initialSearch,
    status: "open",
    method: "all",
    revision: 0,
  });
  const [selectedBatch, setSelectedBatch] = useState<ApiBatch | null>(null);
  const [result, setResult] = useState<PaginatedResponse<ApiDelivery> | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const filterBatch =
    batchId ?? (selectedBatch ? String(selectedBatch.id) : "");

  /** Older pages/searches and hidden route responses cannot replace the visible results. */
  useEffect(() => {
    let active = true;
    /** Never slice an already paginated response or copy real stops into sample storage. */
    async function load() {
      try {
        const params = new URLSearchParams({
          page: String(query.page),
          per_page: String(selecting ? 10 : query.perPage),
          q: query.search,
          status: selecting ? "ready" : query.status,
          method: query.method,
        });
        if (filterBatch) params.set("batch_id", filterBatch);
        const response = await request<PaginatedResponse<ApiDelivery>>(
          `/deliveries?${params}`,
        );
        if (!active) return;
        if (query.page > Math.max(1, response.meta.last_page)) {
          setQuery({ ...query, page: Math.max(1, response.meta.last_page) });
          return;
        }
        setResult(response);
        setLoading(false);
      } catch (cause) {
        if (active) {
          setError(
            cause instanceof ApiError
              ? cause
              : new ApiError(errorMessage(cause), 0),
          );
          setLoading(false);
        }
      }
    }
    const timer = setTimeout(
      /** Debounce typing without a polling loop. */ () => {
        setLoading(true);
        setError(null);
        void load();
      },
      query.search ? 250 : 0,
    );
    /** Cancel visible updates from an earlier request. */
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [request, query, filterBatch, selecting, parcelRevision]);

  /** Changing a filter or entry size restarts page one through the shared controls. */
  function update(values: Partial<typeof query> = {}) {
    setLoading(true);
    setError(null);
    setQuery(
      /** A revision also permits refreshing the same query after a connection failure. */ (
        current,
      ) => ({ ...current, ...values, revision: current.revision + 1 }),
    );
  }

  const controls = {
    page: result?.meta.current_page ?? query.page,
    perPage: selecting ? (10 as const) : query.perPage,
    total: result?.meta.total ?? 0,
    disabled: loading,
    onChange: update,
  };
  const entryBatch = filterBatch || undefined;

  /** Render loading/error/empty/list without exposing stale rows during a new search. */
  function renderStops() {
    if (loading)
      return (
        <div className="card-body">
          <p role="status">Loading your deliveries…</p>
        </div>
      );
    if (error)
      return (
        <EmptyState
          title={
            error.status === 404
              ? "Batch not found"
              : "Couldn’t load deliveries"
          }
          action={
            <Button
              variant="secondary"
              onClick={/** Retry preserves every filter. */ () => update()}
            >
              Try again
            </Button>
          }
        >
          <span role="alert">{error.message}</span>
        </EmptyState>
      );
    if (!result?.data.length)
      return (
        <EmptyState
          title="No matching deliveries"
          action={
            <AddParcelButton batchId={entryBatch}>Add a parcel</AddParcelButton>
          }
        >
          Try another filter or encode a parcel. Older open work remains in its
          original batch.
        </EmptyState>
      );
    return (
      <div className="table-scroll">
        <table className="data-table stop-table">
          <thead>
            <tr>
              <th>Customer & address</th>
              <th>Parcels</th>
              <th>Payment</th>
              <th>Parcel total</th>
              <th>Status</th>
              <th>
                <span className="sr-only">Open</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {result.data.map(
              /** Each result is a complete matching customer/address group from the server. */ (
                stop,
              ) => {
                const statuses = [
                  ...new Set(
                    stop.parcels.map(
                      /** Derive badges only from matching saved parcel outcomes. */ (
                        parcel,
                      ) => parcel.status,
                    ),
                  ),
                ];
                const methods = [
                  ...new Set(
                    stop.parcels.map(
                      /** Actual receipt method takes precedence after collection. */ (
                        parcel,
                      ) => parcel.receipt?.method ?? parcel.expected_method,
                    ),
                  ),
                ];
                const href = `/deliveries/${stop.parcels[0].id}`;
                return (
                  <tr key={stop.key}>
                    <td>
                      <Link href={href} className="customer-link">
                        <Avatar name={stop.customer.name} />
                        <span>
                          <strong>{stop.customer.name}</strong>
                          <small>
                            {stop.address.label} ·{" "}
                            {stop.address.text ?? "Address not provided"}
                          </small>
                          <span className="mobile-status">
                            <StatusBadge
                              status={
                                statuses.length === 1 ? statuses[0] : "partial"
                              }
                            />
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td>
                      <span className="parcel-count">
                        {stop.parcels.length} parcel(s)
                      </span>
                    </td>
                    <td>
                      <Badge
                        tone={
                          methods.length === 1 && methods[0] === "gcash"
                            ? "blue"
                            : "gray"
                        }
                      >
                        {methods.length > 1
                          ? "Mixed"
                          : methods[0] === "gcash"
                            ? "GCash"
                            : "COD cash"}
                      </Badge>
                    </td>
                    <td className="money-cell">
                      {money(
                        stop.parcels.reduce(
                          /** A list total describes matching parcel prices, never a live wallet balance. */ (
                            sum,
                            parcel,
                          ) => sum + parcel.pricing.total,
                          0,
                        ),
                      )}
                    </td>
                    <td>
                      {statuses.map(
                        /** Mixed outcomes remain separately visible. */ (
                          status,
                        ) => (
                          <StatusBadge key={status} status={status} />
                        ),
                      )}
                    </td>
                    <td>
                      {onChoose ? (
                        <Button
                          variant="secondary"
                          onClick={
                            /** The same paginated private list also powers manual route selection. */ () =>
                              onChoose(stop)
                          }
                        >
                          Choose
                        </Button>
                      ) : (
                        <Link
                          href={href}
                          className="row-open"
                          aria-label={`View ${stop.customer.name}'s delivery`}
                        >
                          <ChevronRight size={18} />
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              },
            )}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <>
      {!embedded && (
        <PageHeading
          eyebrow="YOUR PARCELS, ACROSS WEEKS"
          title="Deliveries"
          description="Continue older work alongside new parcels. Outcomes and payment stay separate for every parcel."
        >
          <AddParcelButton batchId={entryBatch}>
            <Plus size={17} />
            Add parcel
          </AddParcelButton>
        </PageHeading>
      )}
      {embedded && !onChoose && (
        <div className="section-summary">
          <span>
            {batchId
              ? "Deliveries in this intake batch"
              : "Your deliveries across intake weeks"}
          </span>
          <AddParcelButton batchId={entryBatch}>
            <Plus size={16} />
            Add parcel
          </AddParcelButton>
        </div>
      )}
      <Card className="delivery-list-card">
        {!onChoose && (
          <div className="tabs">
            {[
              { value: "open", label: "All open" },
              { value: "ready", label: "Ready to deliver" },
              { value: "held", label: "On hold" },
              { value: "failed", label: "Failed" },
              { value: "delivered", label: "Delivered" },
              { value: "returned", label: "Returned" },
              { value: "all", label: "All history" },
            ].map(
              /** Status filters always apply on the server, including due holds. */ (
                tab,
              ) => (
                <button
                  type="button"
                  key={tab.value}
                  className={query.status === tab.value ? "tab-active" : ""}
                  onClick={
                    /** Switch the workflow view from page one. */ () =>
                      update({ status: tab.value, page: 1 })
                  }
                >
                  {tab.label}
                </button>
              ),
            )}
          </div>
        )}
        {!selecting && (
          <div className="table-toolbar">
            <div
              className="toolbar-filters"
              style={{ flexWrap: "wrap", width: "100%" }}
            >
              <select
                aria-label="Filter payment method"
                style={{ flex: "1 1 150px", width: "auto" }}
                value={query.method}
                onChange={
                  /** Match the same parcel's actual or expected method. */ (
                    event,
                  ) => update({ method: event.target.value, page: 1 })
                }
              >
                <option value="all">All payments</option>
                <option value="cash">COD cash</option>
                <option value="gcash">GCash</option>
              </select>
              {!batchId && (
                <ParcelDirectorySelect
                  kind="batch"
                  floating
                  value={selectedBatch}
                  hideLabel
                  clearLabel="All intake weeks"
                  onSelect={
                    /** Filter owned stops by one week or all intake weeks. */ (
                      record,
                    ) => {
                      if (!record || "start" in record) {
                        setSelectedBatch(record);
                        update({ page: 1 });
                      }
                    }
                  }
                />
              )}
              <Button
                variant="ghost"
                onClick={
                  /** Clear list filters without changing the intake history. */ () => {
                    setSelectedBatch(null);
                    update({
                      search: "",
                      status: "open",
                      method: "all",
                      page: 1,
                    });
                  }
                }
              >
                Reset filters
              </Button>
              <Button
                variant="ghost"
                onClick={
                  /** An explicit refresh also updates holds whose retry time just became due. */ () =>
                    update()
                }
              >
                Refresh
              </Button>
            </div>
          </div>
        )}
        <div className="table-toolbar">
          {!selecting && (
            <PaginationEntries {...controls} label="Deliveries pagination" />
          )}
          <div
            className="input-with-icon"
            style={selecting ? { width: "100%" } : undefined}
          >
            <Search size={17} />
            <input
              aria-label="Search deliveries"
              type="search"
              maxLength={100}
              placeholder="Customer, address, seller or parcel…"
              value={query.search}
              onChange={
                /** Search all owned matching work, not only the loaded page. */ (
                  event,
                ) => update({ search: event.target.value, page: 1 })
              }
            />
          </div>
        </div>
        {renderStops()}
        {result && !error && (
          <Pagination
            compact={selecting}
            {...controls}
            label="Deliveries pagination"
          />
        )}
      </Card>
      {!selecting && (
        <p className="small-muted batch-note">
          Each row shows parcels matching these filters. Open a stop to review
          all of its parcels across weeks. Failed and future-held parcels
          require an explicit resume before delivery.
        </p>
      )}
    </>
  );
}
