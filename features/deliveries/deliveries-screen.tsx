"use client";

import { AddParcelButton } from "@/features/parcels/parcel-entry-screen";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Download, ListFilter, Plus, Search } from "lucide-react";
import { usePrototypeState } from "@/lib/prototype/store";
import { getStops, money, selectBatch } from "@/lib/prototype/domain";
import { useActions } from "@/components/providers";
import { Badge, Button, Card, PageHeading, exportCsv } from "@/components/ui";
import { StopTable } from "@/components/delivery-ui";
import {
  Pagination,
  PaginationEntries,
  usePagination,
} from "@/components/pagination";
import { AccountDeliveriesScreen } from "./account-deliveries";

/** Verified accounts use owned stops; sample selection never filters real work. */
export function DeliveriesScreen() {
  const params = useSearchParams();
  const { session } = useActions();
  const initialSearch = params.get("search") ?? "";
  if (session)
    return (
      <AccountDeliveriesScreen
        key={`${session.user.id}-${initialSearch}`}
        initialSearch={initialSearch}
      />
    );
  return (
    <DeliveriesContent key={initialSearch} initialSearch={initialSearch} />
  );
}

/** Paginates filtered stops while keeping batch totals and exports complete. */
function DeliveriesContent({ initialSearch }: { initialSearch: string }) {
  const state = usePrototypeState();
  const { notify, commit } = useActions();
  const [search, setSearch] = useState(initialSearch);
  const [status, setStatus] = useState("all");
  const [method, setMethod] = useState("all");
  const stops = getStops(state);
  const filtered = stops.filter(
    (stop) =>
      (status === "all" ||
        stop.parcels.some((parcel) => parcel.status === status)) &&
      (method === "all" ||
        stop.parcels.some(
          (parcel) =>
            (parcel.receipt?.method ?? parcel.expectedMethod) === method,
        )) &&
      `${stop.customer.name} ${stop.address.text} ${stop.parcels.map((parcel) => parcel.reference).join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const pagination = usePagination(
    filtered,
    JSON.stringify([search, status, method, state.selectedBatchId]),
  );
  return (
    <>
      <PageHeading
        eyebrow="ONE CUSTOMER, EVERY PARCEL"
        title="Deliveries"
        description="Know who’s next, what to collect, and what’s been handed over."
      >
        <Button
          variant="secondary"
          onClick={() => {
            exportCsv("hatid-deliveries.csv", [
              [
                "Reference",
                "Customer",
                "Seller",
                "Status",
                "Customer total (PHP)",
                "Rider fee (PHP)",
                "Seller share (PHP)",
              ],
              ...state.parcels
                .filter((parcel) => parcel.batchId === state.selectedBatchId)
                .map((parcel) => [
                  parcel.reference,
                  state.customers.find(
                    (customer) => customer.id === parcel.customerId,
                  )?.name ?? "",
                  state.sellers.find((seller) => seller.id === parcel.sellerId)
                    ?.name ?? "",
                  parcel.status,
                  parcel.pricing.total / 100,
                  parcel.pricing.fee / 100,
                  parcel.pricing.sellerShare / 100,
                ]),
            ]);
            notify("Delivery report downloaded.");
          }}
        >
          <Download size={16} />
          Export
        </Button>
        <AddParcelButton>
          <Plus size={17} />
          Add parcel
        </AddParcelButton>
      </PageHeading>
      <div className="list-summary">
        <span>
          <strong>{stops.length}</strong> customer stops
        </span>
        <span>
          <strong>
            {
              state.parcels.filter(
                (parcel) => parcel.batchId === state.selectedBatchId,
              ).length
            }
          </strong>{" "}
          parcels in this batch
        </span>
        <span>
          <strong>
            {money(
              state.parcels
                .filter(
                  (parcel) =>
                    parcel.batchId === state.selectedBatchId &&
                    parcel.status === "pending",
                )
                .reduce((sum, parcel) => sum + parcel.pricing.total, 0),
            )}
          </strong>{" "}
          pending collection
        </span>
      </div>
      <Card>
        <div className="tabs">
          {[
            { value: "all", label: "All deliveries" },
            { value: "pending", label: "To deliver" },
            { value: "delivered", label: "Delivered" },
            { value: "held", label: "On hold" },
            { value: "failed", label: "Failed" },
            { value: "returned", label: "Returned" },
          ].map((tab) => (
            <button
              key={tab.value}
              className={status === tab.value ? "tab-active" : ""}
              onClick={() => setStatus(tab.value)}
            >
              {tab.label}
              <span>
                {tab.value === "all"
                  ? stops.length
                  : stops.filter((stop) =>
                      stop.parcels.some(
                        (parcel) => parcel.status === tab.value,
                      ),
                    ).length}
              </span>
            </button>
          ))}
        </div>
        <div className="table-toolbar">
          <div className="input-with-icon">
            <Search size={17} />
            <input
              placeholder="Search customer, address or parcel..."
              aria-label="Search deliveries"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="toolbar-filters">
            <select
              aria-label="Filter payment method"
              value={method}
              onChange={(event) => setMethod(event.target.value)}
            >
              <option value="all">All payments</option>
              <option value="cash">COD cash</option>
              <option value="gcash">GCash</option>
            </select>
            <select
              aria-label="Select weekly batch"
              value={state.selectedBatchId}
              onChange={(event) =>
                commit((current) => selectBatch(current, event.target.value))
              }
            >
              {state.batches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.name}
                </option>
              ))}
            </select>
            <Button
              variant="ghost"
              aria-label="Clear delivery filters"
              onClick={() => {
                setStatus("all");
                setMethod("all");
                setSearch("");
              }}
            >
              <ListFilter size={17} />
              Reset
            </Button>
          </div>
        </div>
        <div className="table-toolbar">
          <PaginationEntries
            {...pagination.controls}
            label="Deliveries pagination"
          />
        </div>
        <StopTable stops={pagination.items} />
        <Pagination {...pagination.controls} label="Deliveries pagination" />
        <div className="card-table-footer">
          <span>
            {filtered.length} of {stops.length} stops
          </span>
          <Badge tone="green">Outcomes are recorded per parcel</Badge>
        </div>
      </Card>
    </>
  );
}
