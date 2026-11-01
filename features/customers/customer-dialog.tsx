"use client";

import { useState } from "react";
import { ChevronRight, MapPin, Plus, Search, UserPlus } from "lucide-react";
import { usePrototypeState } from "@/lib/prototype/store";
import { createCustomer } from "@/lib/prototype/domain";
import type { Customer } from "@/lib/prototype/types";
import { useActions } from "@/components/providers";
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  Field,
  Modal,
} from "@/components/ui";

export function NewCustomerDialog({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved?: (customer: Customer) => void;
}) {
  const { commit } = useActions();
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a customer"
      description="An address or saved location can be added later."
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const data = new FormData(form);
          const id = crypto.randomUUID();
          const customer: Customer = {
            id,
            name: String(data.get("name")).trim(),
            phone: String(data.get("phone")).trim() || "Not provided",
            color: "sage",
            addresses: [
              {
                id: crypto.randomUUID(),
                label: String(data.get("label")) || "Home",
                text:
                  String(data.get("address")).trim() || "Address not provided",
                latitude: null,
                longitude: null,
                distanceKm: 0,
                minutes: 0,
              },
            ],
          };
          if (
            commit(
              (state) => createCustomer(state, customer),
              "Customer saved on this device.",
            )
          ) {
            form.reset();
            onSaved?.(customer);
            onClose();
          }
        }}
      >
        <div className="dialog-body form-stack">
          <Field label="Full name" required>
            <input
              name="name"
              placeholder="e.g. Maria Santos"
              required
              minLength={2}
              maxLength={100}
              autoComplete="off"
            />
          </Field>
          <Field
            label="Phone number"
            hint="Optional. Helps you distinguish customers with the same name."
          >
            <input
              name="phone"
              type="tel"
              placeholder="09XX XXX XXXX"
              maxLength={30}
              autoComplete="off"
            />
          </Field>
          <div className="form-grid">
            <Field label="Address label">
              <select name="label">
                <option>Home</option>
                <option>Work</option>
                <option>Other</option>
              </select>
            </Field>
            <Field label="Address (optional)">
              <input
                name="address"
                placeholder="Street, barangay or landmark"
                maxLength={300}
              />
            </Field>
          </div>
          <div className="notice">
            <MapPin size={19} />
            <p>
              No location pin needed. You can deliver manually and optionally
              save a verified pin after handover.
            </p>
          </div>
        </div>
        <footer className="dialog-footer">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">
            <UserPlus size={16} />
            Save customer
          </Button>
        </footer>
      </form>
    </Modal>
  );
}

export function CustomerPicker({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (customer: Customer) => void;
}) {
  const state = usePrototypeState();
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const matches = state.customers.filter((customer) =>
    `${customer.name} ${customer.phone} ${customer.addresses.map((address) => address.text).join(" ")}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Who is this parcel for?"
        description="Search first to keep a customer’s parcels together."
      >
        <div className="dialog-body">
          <div className="input-with-icon">
            <Search size={17} />
            <input
              autoComplete="off"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search customers"
              placeholder="Name, phone number or address..."
            />
          </div>
          <div className="customer-picker-list">
            {matches.map((customer) => (
              <button
                key={customer.id}
                onClick={() => {
                  onSelect(customer);
                  onClose();
                }}
              >
                <Avatar name={customer.name} color={customer.color} />
                <span>
                  <strong>{customer.name}</strong>
                  <small>
                    {customer.phone} · {customer.addresses[0]?.text}
                  </small>
                </span>
                {customer.addresses.every(
                  (address) => address.latitude === null,
                ) && <Badge tone="amber">No pin</Badge>}
                <ChevronRight size={17} />
              </button>
            ))}
          </div>
          {!matches.length && (
            <EmptyState title="No customer found">
              Add a new customer without leaving this parcel.
            </EmptyState>
          )}
        </div>
        <footer className="dialog-footer">
          <span className="small-muted">
            {matches.length} matching customers
          </span>
          <Button onClick={() => setAddOpen(true)}>
            <Plus size={16} />
            Add new customer
          </Button>
        </footer>
      </Modal>
      <NewCustomerDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={(customer) => {
          onSelect(customer);
          onClose();
        }}
      />
    </>
  );
}
