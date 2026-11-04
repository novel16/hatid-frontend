"use client";

import Link from "next/link";
import { useState, type ReactNode, type SyntheticEvent } from "react";
import { ArrowRight, CalendarDays, Plus } from "lucide-react";
import { Button, Field, Modal } from "@/components/ui";
import { ApiError, errorMessage, type NewBatch } from "@/lib/api";
import { formatDate } from "@/lib/prototype/domain";

/** Reuses one card layout for account metadata and the separate sample progress preview. */
export function BatchCard({
  batch,
  badge,
  children,
}: {
  batch: NewBatch & { id: string | number };
  badge: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="card batch-card">
      <div className="batch-card-top">
        <span className="calendar-icon">
          <CalendarDays size={24} />
        </span>
        {badge}
      </div>
      <h2>{batch.name}</h2>
      <p>
        {formatDate(batch.start)} – {formatDate(batch.end)}
      </p>
      {children}
      <Link
        className="button button-secondary button-full"
        href={`/batches/${batch.id}`}
      >
        Open batch
        <ArrowRight size={16} />
      </Link>
    </section>
  );
}

/** Shares the intake form while preserving entered values and field errors after a failed save. */
export function BatchDialog({
  initial,
  onSave,
  onClose,
}: {
  initial: NewBatch;
  onSave: (values: NewBatch) => Promise<void> | void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  /** Waits for confirmed persistence before the caller closes or navigates away. */
  async function save(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    const values = {
      name: String(data.get("name") ?? "").trim(),
      start: String(data.get("start") ?? ""),
      end: String(data.get("end") ?? ""),
    };
    setBusy(true);
    setError("");
    setErrors({});
    try {
      if (values.end < values.start) {
        const message = "The end date must be on or after the start date.";
        throw new ApiError(message, 422, { end: [message] });
      }
      await onSave(values);
    } catch (cause) {
      setError(errorMessage(cause));
      if (cause instanceof ApiError) setErrors(cause.errors);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title="Start a weekly batch"
      description="Choose the intake dates for your parcels. Older batches remain available after their end date."
      onClose={
        /** A pending save must finish before the form can be dismissed. */
        () => {
          if (!busy) onClose();
        }
      }
    >
      <form method="post" onSubmit={save}>
        <div className="dialog-body form-stack">
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <Field label="Batch name" required error={errors.name?.[0]}>
            <input
              name="name"
              defaultValue={initial.name}
              required
              minLength={2}
              maxLength={60}
              disabled={busy}
              aria-invalid={!!errors.name}
              placeholder="e.g. Week of November 2"
            />
          </Field>
          <div className="form-grid">
            <Field label="Starts" required error={errors.start?.[0]}>
              <input
                name="start"
                type="date"
                defaultValue={initial.start}
                required
                disabled={busy}
                aria-invalid={!!errors.start}
              />
            </Field>
            <Field label="Ends" required error={errors.end?.[0]}>
              <input
                name="end"
                type="date"
                defaultValue={initial.end}
                required
                disabled={busy}
                aria-invalid={!!errors.end}
              />
            </Field>
          </div>
        </div>
        <footer className="dialog-footer">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            <Plus size={16} />
            {busy ? "Creating…" : "Create batch"}
          </Button>
        </footer>
      </form>
    </Modal>
  );
}
