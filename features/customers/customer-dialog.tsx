"use client";

import { useState, type FormEvent } from "react";
import { Check, CircleAlert, MapPin, UserPlus } from "lucide-react";
import { createCustomer } from "@/lib/prototype/domain";
import type { Customer } from "@/lib/prototype/types";
import { ApiError, errorMessage } from "@/lib/api";
import { useActions } from "@/components/providers";
import { Button, Field, Modal } from "@/components/ui";

export interface AddressValues {
  label: string;
  text: string | null;
}

export interface CustomerValues {
  name: string;
  phone: string | null;
  address?: AddressValues;
}

/** Reuses customer fields for demo creation and account create/edit callbacks. */
export function CustomerDialog({
  open,
  onClose,
  onSaved,
  onSave,
  initialValues,
}: {
  open: boolean;
  onClose: () => void;
  onSaved?: (customer: Customer) => void;
  onSave?: (values: CustomerValues) => Promise<void>;
  initialValues?: { name: string; phone: string | null };
}) {
  const { commit } = useActions();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  /** Keeps the form available until its current save finishes. */
  function close() {
    if (!busy) onClose();
  }

  /** Saves through the caller's API callback or the existing isolated demo store. */
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const values: CustomerValues = {
      name: String(data.get("name") ?? "").trim(),
      phone: String(data.get("phone") ?? "").trim() || null,
    };
    if (!initialValues) {
      values.address = {
        label: String(data.get("label") ?? "Home").trim(),
        text: String(data.get("address") ?? "").trim() || null,
      };
    }
    setBusy(true);
    setError("");
    setErrors({});
    try {
      if (onSave) {
        await onSave(values);
      } else {
        const customer: Customer = {
          id: crypto.randomUUID(),
          name: values.name,
          phone: values.phone ?? "Not provided",
          color: "sage",
          addresses: [
            {
              id: crypto.randomUUID(),
              label: values.address?.label ?? "Home",
              text: values.address?.text ?? "Address not provided",
              latitude: null,
              longitude: null,
              distanceKm: 0,
              minutes: 0,
            },
          ],
        };
        if (
          !commit(
            /** Explicit demo saves stay in the sample store. */
            (state) => createCustomer(state, customer),
            "Customer saved on this device.",
          )
        )
          return;
        onSaved?.(customer);
      }
      form.reset();
      onClose();
    } catch (cause) {
      setError(errorMessage(cause, "Unable to save this customer."));
      if (cause instanceof ApiError) setErrors(cause.errors);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={initialValues ? "Edit customer" : "Add a customer"}
      description={
        onSave
          ? "Saved privately to your Hatid rider account."
          : "An address or saved location can be added later."
      }
    >
      <form method="post" onSubmit={submit}>
        <div className="dialog-body form-stack">
          <fieldset disabled={busy} className="form-stack form-fieldset">
            {error && (
              <div className="form-error" role="alert">
                <CircleAlert size={18} />
                <p>{error}</p>
              </div>
            )}
            <Field label="Full name" required error={errors.name?.[0]}>
              <input
                name="name"
                placeholder="e.g. Maria Santos"
                required
                minLength={2}
                maxLength={100}
                defaultValue={initialValues?.name}
                autoComplete="off"
                aria-invalid={!!errors.name}
              />
            </Field>
            <Field
              label="Phone number"
              hint="Optional. Helps distinguish customers with the same name."
              error={errors.phone?.[0]}
            >
              <input
                name="phone"
                type="tel"
                placeholder="09XX XXX XXXX"
                maxLength={30}
                defaultValue={initialValues?.phone ?? ""}
                autoComplete="off"
                aria-invalid={!!errors.phone}
              />
            </Field>
            {!initialValues && (
              <div className="form-grid">
                <Field
                  label="Address label"
                  error={errors["address.label"]?.[0]}
                >
                  <select name="label" defaultValue="Home">
                    <option>Home</option>
                    <option>Work</option>
                    <option>Other</option>
                  </select>
                </Field>
                <Field
                  label="Address (optional)"
                  error={errors["address.text"]?.[0]}
                >
                  <input
                    name="address"
                    placeholder="Street, barangay or landmark"
                    maxLength={300}
                  />
                </Field>
              </div>
            )}
            <div className="notice">
              <MapPin size={19} />
              <p>
                No GPS pin needed. Addresses stay separate; verified GPS is
                saved only after a successful delivery.
              </p>
            </div>
          </fieldset>
        </div>
        <footer className="dialog-footer">
          <Button variant="secondary" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            <UserPlus size={16} />
            {busy
              ? "Saving…"
              : initialValues
                ? "Save changes"
                : "Save customer"}
          </Button>
        </footer>
      </form>
    </Modal>
  );
}

/** Shares address metadata fields across account management and the prototype. */
export function AddressDialog({
  initialValues,
  onSave,
  onClose,
}: {
  initialValues?: AddressValues;
  onSave: (values: AddressValues) => Promise<void> | void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  /** Keeps a pending address write from being dismissed prematurely. */
  function close() {
    if (!busy) onClose();
  }

  /** Sends only address text/label, leaving customer identity and GPS evidence unchanged. */
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setErrors({});
    try {
      await onSave({
        label: String(data.get("label") ?? "").trim(),
        text: String(data.get("text") ?? "").trim() || null,
      });
      onClose();
    } catch (cause) {
      setError(errorMessage(cause, "Unable to save this address."));
      if (cause instanceof ApiError) setErrors(cause.errors);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={close}
      title={initialValues ? "Edit address" : "Add an address"}
      description="Keep each delivery location separate for this customer."
    >
      <form method="post" onSubmit={submit}>
        <div className="dialog-body form-stack">
          <fieldset disabled={busy} className="form-stack form-fieldset">
            {error && (
              <div className="form-error" role="alert">
                <CircleAlert size={18} />
                <p>{error}</p>
              </div>
            )}
            <Field label="Address label" required error={errors.label?.[0]}>
              <input
                name="label"
                required
                maxLength={50}
                defaultValue={initialValues?.label ?? "Home"}
                placeholder="e.g. Home or Work"
                aria-invalid={!!errors.label}
              />
            </Field>
            <Field
              label="Address / landmark (optional)"
              error={errors.text?.[0]}
            >
              <textarea
                name="text"
                rows={3}
                maxLength={300}
                defaultValue={initialValues?.text ?? ""}
                placeholder="Street, barangay or landmark"
                aria-invalid={!!errors.text}
              />
            </Field>
            <div className="notice notice-muted">
              <MapPin size={18} />
              <p>
                This form updates address details. GPS verification follows a
                successful delivery.
              </p>
            </div>
          </fieldset>
        </div>
        <footer className="dialog-footer">
          <Button variant="secondary" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            <Check size={16} />
            {busy ? "Saving…" : "Save address"}
          </Button>
        </footer>
      </form>
    </Modal>
  );
}
