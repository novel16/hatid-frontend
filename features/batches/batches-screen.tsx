"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Package,
  Plus,
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
  Field,
  LinkButton,
  Modal,
  PageHeading,
} from "@/components/ui";
import { StopTable } from "@/components/delivery-ui";
import {
  Pagination,
  PaginationEntries,
  usePagination,
} from "@/components/pagination";

/** Reuses list pagination for weekly cards and a selected batch's customer stops. */
export function BatchesScreen({ batchId }: { batchId?: string }) {
  const state = usePrototypeState();
  const { commit, notify } = useActions();
  const [open, setOpen] = useState(false);
  const batch = state.batches.find((item) => item.id === batchId);
  const summary = batch ? totals(state, batch.id) : null;
  const batches = usePagination(state.batches);
  const stops = usePagination(getStops(state, batchId), batchId);
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
                `${batch.name} is your active batch.`,
              )
            }
            variant={
              state.selectedBatchId === batch.id ? "secondary" : "primary"
            }
          >
            <Check size={16} />
            {state.selectedBatchId === batch.id
              ? "Active batch"
              : "Make active"}
          </Button>
        ) : (
          <Button onClick={() => setOpen(true)}>
            <Plus size={17} />
            New weekly batch
          </Button>
        )}
        {batch && (
          <LinkButton
            href="/parcels/new"
            onClick={() => commit((current) => selectBatch(current, batch.id))}
          >
            <Plus size={17} />
            Add parcel
          </LinkButton>
        )}
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
              <section className="card batch-card" key={entry.id}>
                <div className="batch-card-top">
                  <span className="calendar-icon">
                    <CalendarDays size={24} />
                  </span>
                  <Badge
                    tone={state.selectedBatchId === entry.id ? "green" : "gray"}
                  >
                    {state.selectedBatchId === entry.id
                      ? "Active"
                      : count.count
                        ? "In workspace"
                        : "Ready to fill"}
                  </Badge>
                </div>
                <h2>{entry.name}</h2>
                <p>
                  {formatDate(entry.start)} – {formatDate(entry.end)}
                </p>
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
                <Link
                  className="button button-secondary button-full"
                  href={`/batches/${entry.id}`}
                >
                  Open batch
                  <ArrowRight size={16} />
                </Link>
              </section>
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
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Start a weekly batch"
        description="Choose the dates you use to organise your parcels."
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const start = String(data.get("start"));
            const end = String(data.get("end"));
            if (end < start) {
              notify("The end date must be on or after the start date.", true);
              return;
            }
            const id = crypto.randomUUID();
            commit(
              (current) =>
                selectBatch(
                  {
                    ...current,
                    batches: [
                      { id, name: String(data.get("name")).trim(), start, end },
                      ...current.batches,
                    ],
                  },
                  id,
                ),
              "New weekly batch is ready.",
            );
            setOpen(false);
          }}
        >
          <div className="dialog-body form-stack">
            <Field label="Batch name" required>
              <input
                name="name"
                required
                maxLength={60}
                placeholder="e.g. Week 46"
              />
            </Field>
            <div className="form-grid">
              <Field label="Starts" required>
                <input name="start" type="date" required />
              </Field>
              <Field label="Ends" required>
                <input name="end" type="date" required />
              </Field>
            </div>
          </div>
          <footer className="dialog-footer">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">
              <Plus size={16} />
              Create batch
            </Button>
          </footer>
        </form>
      </Modal>
    </>
  );
}
