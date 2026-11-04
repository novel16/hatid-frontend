"use client";

import { AddParcelButton } from "@/features/parcels/parcel-entry-screen";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Package,
  Plus,
  Search,
} from "lucide-react";
import { usePrototypeState } from "@/lib/prototype/store";
import {
  formatDate,
  getStops,
  money,
  totals,
  selectBatch,
} from "@/lib/prototype/domain";
import { useActions } from "@/components/providers";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  LinkButton,
  PageHeading,
} from "@/components/ui";
import { StopTable } from "@/components/delivery-ui";
import { BatchCard, BatchDialog } from "@/features/batches/batch-components";
import { AccountDeliveriesScreen } from "@/features/deliveries/account-deliveries";
import {
  ApiError,
  errorMessage,
  type ApiBatch,
  type BatchPage,
  type NewBatch,
} from "@/lib/api";
import type { PaginationState } from "@/lib/pagination";
import {
  Pagination,
  PaginationEntries,
  usePagination,
} from "@/components/pagination";

type BatchScreenProps = { batchId?: string };

/** Keeps actual account records separate from the existing local sample workflows. */
export function BatchesScreen(props: BatchScreenProps) {
  const { session } = useActions();
  return session ? (
    <AccountBatchesScreen key={session.user.id} {...props} />
  ) : (
    <DemoBatchesScreen {...props} />
  );
}

/** Preserves sample progress and stops without storing account batch identifiers locally. */
function DemoBatchesScreen({ batchId }: BatchScreenProps) {
  const state = usePrototypeState();
  const { commit } = useActions();
  const [open, setOpen] = useState(false);
  const batch = state.batches.find((item) => item.id === batchId);
  const summary = batch ? totals(state, batch.id) : null;
  const batches = usePagination(state.batches);
  const stops = usePagination(getStops(state, batchId), batchId);

  /** Uses the same date-range guard while writing only to the sample store. */
  function createDemoBatch(values: NewBatch) {
    if (
      state.batches.some(
        /** A date range has one sample record, just like an owned account range. */
        (entry) => entry.start === values.start && entry.end === values.end,
      )
    ) {
      const message =
        "You already have a batch for this date range. Open it from Weekly batches.";
      throw new ApiError(message, 422, { start: [message] });
    }
    const id = crypto.randomUUID();
    if (
      !commit(
        /** Demo selection never changes the verified account's records. */
        (current) =>
          selectBatch(
            { ...current, batches: [{ id, ...values }, ...current.batches] },
            id,
          ),
        "New sample batch is ready.",
      )
    )
      throw new Error("Unable to save the sample batch.");
    setOpen(false);
  }
  if (batchId && !batch)
    return (
      <EmptyState
        title="Batch not found"
        action={<LinkButton href="/batches">All weekly batches</LinkButton>}
      >
        Choose another batch from your workspace.
      </EmptyState>
    );
  return (
    <>
      {batch && (
        <LinkButton href="/batches" variant="ghost" className="back-link">
          <ArrowLeft size={15} />
          Weekly batches
        </LinkButton>
      )}
      <PageHeading
        eyebrow="A WEEK AT A TIME"
        title={batch ? `${batch.name} · your delivery batch` : "Weekly batches"}
        description={
          batch
            ? `${formatDate(batch.start)} – ${formatDate(batch.end)} · Original dates are preserved when a parcel needs another attempt.`
            : "Keep every week organised, with a clear view of what’s still on your route."
        }
      >
        {batch ? (
          <Button
            onClick={() =>
              commit(
                (current) => selectBatch(current, batch.id),
                `${batch.name} is your selected sample batch.`,
              )
            }
            variant={
              state.selectedBatchId === batch.id ? "secondary" : "primary"
            }
          >
            <Check size={16} />
            {state.selectedBatchId === batch.id
              ? "Selected sample batch"
              : "Select sample batch"}
          </Button>
        ) : (
          <Button onClick={() => setOpen(true)}>
            <Plus size={17} />
            New weekly batch
          </Button>
        )}
        {batch && <AddParcelButton batchId={batch.id} />}
      </PageHeading>
      {!batch && (
        <div className="directory-toolbar">
          <PaginationEntries
            {...batches.controls}
            label="Weekly batches pagination"
          />
        </div>
      )}
      {batch && summary ? (
        <>
          <div className="metrics batch-metrics">
            {[
              { label: "Parcels in batch", value: summary.count },
              { label: "Successfully delivered", value: summary.delivered },
              { label: "Still to deliver", value: summary.pending },
              { label: "Rider fees retained", value: money(summary.fees) },
            ].map((metric) => (
              <div className="metric-card" key={metric.label}>
                <p>{metric.label}</p>
                <strong>{metric.value}</strong>
              </div>
            ))}
          </div>
          <Card
            title="Customer stops"
            description="A stop groups parcels for the same customer and address."
          >
            <div className="table-toolbar">
              <PaginationEntries
                {...stops.controls}
                label="Batch stops pagination"
              />
            </div>
            <StopTable stops={stops.items} />
            <Pagination {...stops.controls} label="Batch stops pagination" />
          </Card>
        </>
      ) : (
        <div className="batch-grid">
          {batches.items.map((entry) => {
            const count = totals(state, entry.id);
            const percent = count.count
              ? Math.round((count.delivered / count.count) * 100)
              : 0;
            return (
              <BatchCard
                batch={entry}
                key={entry.id}
                badge={
                  <Badge
                    tone={state.selectedBatchId === entry.id ? "green" : "gray"}
                  >
                    {state.selectedBatchId === entry.id
                      ? "Selected sample"
                      : count.count
                        ? "In workspace"
                        : "Ready to fill"}
                  </Badge>
                }
              >
                <div className="batch-count">
                  <Package size={17} />
                  <strong>{count.count} parcels</strong>
                  <span>{count.delivered} delivered</span>
                </div>
                <div className="linear-progress">
                  <span style={{ width: `${percent}%` }} />
                </div>
                <div className="batch-progress-caption">
                  <span>{percent}% delivered</span>
                  <span>{count.pending} to deliver</span>
                </div>
              </BatchCard>
            );
          })}
        </div>
      )}
      {!batch && (
        <Pagination {...batches.controls} label="Weekly batches pagination" />
      )}
      <div className="notice notice-muted batch-note">
        <CalendarDays size={18} />
        <p>
          A hold or failed attempt keeps its original batch. Schedule the next
          attempt without losing the parcel’s history.
        </p>
      </div>
      {open && (
        <BatchDialog
          initial={{ name: "", start: "", end: "" }}
          onSave={createDemoBatch}
          onClose={
            /** Closing the form leaves the sample collection unchanged. */
            () => setOpen(false)
          }
        />
      )}
    </>
  );
}

/** Reads and creates real batches with server pagination, without modifying sample selection. */
function AccountBatchesScreen({ batchId }: BatchScreenProps) {
  const { request, notify } = useActions();
  const router = useRouter();
  const [query, setQuery] = useState<
    PaginationState & { search: string; revision: number }
  >({ page: 1, perPage: 10, search: "", revision: 0 });
  const [result, setResult] = useState<BatchPage | null>(null);
  const [batch, setBatch] = useState<ApiBatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [initial, setInitial] = useState<NewBatch | null>(null);
  const [opening, setOpening] = useState(false);
  const viewVersion = useRef(0);

  /** Invalidates later action responses when leaving this view, including a cached page. */
  useEffect(() => {
    /** Returning to a view must not revive an earlier navigation action. */
    return () => {
      viewVersion.current += 1;
    };
  }, []);

  /** Fetches owned data and ignores superseded search/detail responses. */
  useEffect(() => {
    let active = true;
    /** Keeps detail and list responses explicit rather than casting their shapes. */
    async function load() {
      try {
        if (batchId) {
          const response = await request<{ data: ApiBatch }>(
            `/batches/${encodeURIComponent(batchId)}`,
          );
          if (!active) return;
          setBatch(response.data);
        } else {
          const params = new URLSearchParams({
            page: String(query.page),
            per_page: String(query.perPage),
            q: query.search,
          });
          const response = await request<BatchPage>(`/batches?${params}`);
          if (!active) return;
          const lastPage = Math.max(1, response.meta.last_page);
          if (query.page > lastPage) {
            setQuery({ ...query, page: lastPage });
            return;
          }
          setResult(response);
        }
        setLoading(false);
      } catch (cause) {
        if (!active) return;
        setError(
          cause instanceof ApiError
            ? cause
            : new ApiError(errorMessage(cause), 0),
        );
        setLoading(false);
      }
    }
    const timer = setTimeout(
      /** Debounce typing without adding a search library or polling loop. */
      () => {
        void load();
      },
      query.search ? 250 : 0,
    );
    /** Older requests cannot replace a newer page or a different detail view. */
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [request, batchId, query]);

  /** Preserves unaffected search/entry choices while enabling an explicit retry. */
  function updateQuery(values: Partial<typeof query> = {}) {
    setLoading(true);
    setError(null);
    setQuery(
      /** A revision permits a refresh of the same query. */
      (current) => ({ ...current, ...values, revision: current.revision + 1 }),
    );
  }

  /** Refreshes defaults even if the page has stayed open across a new local week. */
  async function openCreate() {
    if (opening) return;
    const attempt = viewVersion.current;
    setOpening(true);
    try {
      const response = await request<BatchPage>("/batches?per_page=1");
      if (attempt === viewVersion.current) setInitial(response.current_week);
    } catch (cause) {
      notify(errorMessage(cause), true);
    } finally {
      setOpening(false);
    }
  }

  /** Opens the saved batch only after confirmed persistence and while this view is still active. */
  async function createBatch(values: NewBatch) {
    const attempt = viewVersion.current;
    const response = await request<{ data: ApiBatch }>(
      "/batches",
      "POST",
      values,
    );
    if (attempt !== viewVersion.current) return;
    setInitial(null);
    updateQuery({ search: "", page: 1 });
    notify("Weekly batch saved to your account.");
    router.push(`/batches/${response.data.id}`);
  }

  const controls = {
    page: result?.meta.current_page ?? query.page,
    perPage: query.perPage,
    total: result?.meta.total ?? 0,
    onChange: updateQuery,
    disabled: loading,
  };
  const labels = {
    current: "Current period",
    previous: "Previous period",
    upcoming: "Upcoming",
  };

  /** Renders one loading/error/detail/list state with straightforward guard clauses. */
  function renderContent() {
    if (loading)
      return (
        <Card>
          <div className="card-body">
            <p role="status">Loading your {batchId ? "batch" : "batches"}…</p>
          </div>
        </Card>
      );
    if (error)
      return (
        <Card>
          <EmptyState
            title={
              error.status === 404
                ? "Batch not found"
                : "Couldn’t load your batches"
            }
            action={
              error.status === 404 ? (
                <LinkButton href="/batches" variant="secondary">
                  All weekly batches
                </LinkButton>
              ) : (
                <Button
                  variant="secondary"
                  onClick={
                    /** Retry keeps the current filter and entry size intact. */
                    () => updateQuery()
                  }
                >
                  Try again
                </Button>
              )
            }
          >
            <span role="alert">
              {error.status === 404
                ? "Choose a batch from your own workspace."
                : error.message}
            </span>
          </EmptyState>
        </Card>
      );
    if (batch)
      return (
        <>
          <div className="section-summary">
            <Badge tone={batch.period === "current" ? "green" : "gray"}>
              {labels[batch.period]}
            </Badge>
            <span>Viewing this batch</span>
          </div>
          <AccountDeliveriesScreen batchId={String(batch.id)} embedded />
        </>
      );
    if (result?.data.length)
      return (
        <div className="batch-grid">
          {result.data.map(
            /** Calendar context does not imply delivery completion. */
            (entry) => (
              <BatchCard
                key={entry.id}
                batch={entry}
                badge={
                  <Badge tone={entry.period === "current" ? "green" : "gray"}>
                    {labels[entry.period]}
                  </Badge>
                }
              >
                <div className="batch-count">
                  <Package size={17} />
                  <span>Ready for parcels</span>
                </div>
              </BatchCard>
            ),
          )}
        </div>
      );
    return (
      <Card>
        <EmptyState
          title={
            query.search.trim()
              ? "No matching batches"
              : "No weekly batches yet"
          }
          action={
            <Button onClick={openCreate} disabled={opening}>
              <Plus size={16} />
              New weekly batch
            </Button>
          }
        >
          {query.search.trim()
            ? "Try another batch name or create a new intake week."
            : "Start a batch for your first intake week."}
        </EmptyState>
      </Card>
    );
  }

  return (
    <>
      {batchId && (
        <LinkButton href="/batches" variant="ghost" className="back-link">
          <ArrowLeft size={15} />
          Weekly batches
        </LinkButton>
      )}
      <PageHeading
        eyebrow="A WEEK AT A TIME"
        title={batch?.name ?? (batchId ? "Weekly batch" : "Weekly batches")}
        description={
          batch
            ? `${formatDate(batch.start)} – ${formatDate(batch.end)} · Original intake dates stay with this batch.`
            : "Organise your parcel intake by week. Previous batches remain available."
        }
      >
        {!batchId && (
          <Button onClick={openCreate} disabled={opening}>
            <Plus size={17} />
            {opening ? "Preparing…" : "New weekly batch"}
          </Button>
        )}
      </PageHeading>
      {!batchId && (
        <div className="directory-toolbar">
          <PaginationEntries {...controls} label="Weekly batches pagination" />
          <div className="input-with-icon">
            <Search size={17} />
            <input
              type="search"
              aria-label="Search weekly batches"
              placeholder="Search batches by name…"
              maxLength={100}
              value={query.search}
              onChange={
                /** A search always starts at page one. */
                (event) => updateQuery({ search: event.target.value, page: 1 })
              }
            />
          </div>
        </div>
      )}
      {renderContent()}
      {!batchId && result && !error && (
        <Pagination {...controls} label="Weekly batches pagination" />
      )}
      <div className="notice notice-muted batch-note">
        <CalendarDays size={18} />
        <p>
          Batch dates organise intake. An earlier week stays available so
          unfinished deliveries can continue with their original history.
        </p>
      </div>
      {initial && (
        <BatchDialog
          initial={initial}
          onSave={createBatch}
          onClose={
            /** Cancelling creates no account or sample records. */
            () => setInitial(null)
          }
        />
      )}
    </>
  );
}
