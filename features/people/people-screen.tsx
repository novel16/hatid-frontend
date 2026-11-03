"use client";

import { useState } from "react";
import {
  ChevronRight,
  MapPin,
  MapPinOff,
  Pencil,
  Plus,
  Search,
  Users,
} from "lucide-react";
import { usePrototypeState } from "@/lib/prototype/store";
import { money, sellerBalance } from "@/lib/prototype/domain";
import type { Address, Seller } from "@/lib/prototype/types";
import { useActions } from "@/components/providers";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  LinkButton,
  Modal,
  PageHeading,
} from "@/components/ui";
import {
  AddressDialog,
  CustomerDialog,
} from "@/features/customers/customer-dialog";
import { LocationDialog } from "@/features/customers/location-dialog";
import {
  SellerDialog,
  SellerPricingGuide,
} from "@/features/sellers/seller-dialog";
import {
  AccountCustomersScreen,
  AccountSellersScreen,
} from "./account-directory";

/** Selects private API management or the explicit demo customer directory. */
export function CustomersScreen() {
  const { mode } = useActions();
  return mode === "authenticated" ? (
    <AccountCustomersScreen />
  ) : (
    <DemoCustomersScreen />
  );
}

/** Preserves local sample customers and delivery/GPS review workflows in demo mode. */
function DemoCustomersScreen() {
  const state = usePrototypeState();
  const { commit, notify } = useActions();
  const [query, setQuery] = useState("");
  const [add, setAdd] = useState(false);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [newAddress, setNewAddress] = useState(false);
  const [location, setLocation] = useState<Address | null>(null);
  const selected = state.customers.find(
    (customer) => customer.id === customerId,
  );
  const customers = state.customers.filter((customer) =>
    `${customer.name} ${customer.phone} ${customer.addresses.map((address) => address.text).join(" ")}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        eyebrow="FAMILIAR FACES, EASIER VISITS"
        title="Your customers"
        description="One customer, distinct addresses, and a pin you can trust."
      >
        <Button onClick={() => setAdd(true)}>
          <Plus size={17} />
          Add customer
        </Button>
      </PageHeading>
      <div className="section-summary">
        <Badge tone="green">
          <Users size={14} />
          {state.customers.length} customers
        </Badge>
        <span>
          {
            state.customers.filter((customer) =>
              customer.addresses.some((address) => address.latitude === null),
            ).length
          }{" "}
          with an unsaved location
        </span>
      </div>
      <Card>
        <div className="table-toolbar">
          <div className="input-with-icon">
            <Search size={17} />
            <input
              aria-label="Search customer directory"
              placeholder="Search name, phone or address..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <span className="small-muted">
            Addresses stay separate for each customer
          </span>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Contact</th>
                <th>Primary address</th>
                <th>Locations</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id}>
                  <td>
                    <button
                      className="customer-link"
                      onClick={() => setCustomerId(customer.id)}
                    >
                      <Avatar name={customer.name} color={customer.color} />
                      <span>
                        <strong>{customer.name}</strong>
                        <small>
                          {
                            state.parcels.filter(
                              (parcel) => parcel.customerId === customer.id,
                            ).length
                          }{" "}
                          parcel record(s)
                        </small>
                      </span>
                    </button>
                  </td>
                  <td>{customer.phone}</td>
                  <td>
                    <span className="address-cell">
                      {customer.addresses[0]?.text}
                    </span>
                  </td>
                  <td>
                    <Badge
                      tone={
                        customer.addresses.every(
                          (address) => address.latitude !== null,
                        )
                          ? "green"
                          : "amber"
                      }
                    >
                      {customer.addresses.every(
                        (address) => address.latitude !== null,
                      )
                        ? "Pin saved"
                        : "No pin"}
                    </Badge>
                    <small className="cell-subtext">
                      {customer.addresses.length} address(es)
                    </small>
                  </td>
                  <td>
                    <button
                      className="row-open"
                      onClick={() => setCustomerId(customer.id)}
                      aria-label={`Open ${customer.name}'s customer profile`}
                    >
                      <ChevronRight size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!customers.length && (
            <EmptyState
              title="No matching customers"
              action={
                <Button onClick={() => setAdd(true)}>
                  <Plus size={16} />
                  Add customer
                </Button>
              }
            >
              Try another name or add a customer.
            </EmptyState>
          )}
        </div>
      </Card>
      {add && <CustomerDialog open onClose={() => setAdd(false)} />}
      {selected && (
        <Modal
          open
          drawer
          onClose={() => {
            setCustomerId(null);
            setNewAddress(false);
          }}
          title="Customer profile"
          description="Addresses and delivery records stay linked."
        >
          <div className="dialog-body form-stack">
            <div className="person-profile">
              <Avatar name={selected.name} color={selected.color} />
              <h3>{selected.name}</h3>
              <p>{selected.phone}</p>
            </div>
            <div className="section-title">
              <h3>Delivery addresses</h3>
              <button
                className="text-link"
                onClick={() => setNewAddress((value) => !value)}
              >
                <Plus size={14} />
                Add address
              </button>
            </div>
            {selected.addresses.map((address) => (
              <div className="address-card" key={address.id}>
                <div>
                  <span>
                    {address.latitude === null ? (
                      <MapPinOff size={19} />
                    ) : (
                      <MapPin size={19} />
                    )}
                  </span>
                  <div>
                    <h4>{address.label}</h4>
                    <p>{address.text}</p>
                    <Badge tone={address.latitude === null ? "amber" : "green"}>
                      {address.latitude === null
                        ? "Manual delivery available"
                        : "Confirmed pin saved"}
                    </Badge>
                  </div>
                </div>
                <button
                  className="text-link"
                  onClick={() => {
                    if (
                      address.verifiedAt ||
                      state.parcels.some(
                        (parcel) =>
                          parcel.customerId === selected.id &&
                          parcel.addressId === address.id &&
                          parcel.status === "delivered",
                      )
                    )
                      setLocation(address);
                    else
                      notify(
                        "Complete a delivery to this address before saving a verified location.",
                      );
                  }}
                >
                  <Pencil size={13} />
                  {address.latitude === null
                    ? "Add after handover"
                    : "Review / correct pin"}
                </button>
              </div>
            ))}
            <h3>Parcel history</h3>
            <div className="mini-record-list">
              {state.parcels
                .filter((parcel) => parcel.customerId === selected.id)
                .map((parcel) => (
                  <LinkButton
                    key={parcel.id}
                    href={`/deliveries/${parcel.id}`}
                    variant="ghost"
                  >
                    {parcel.reference}
                    <span>{money(parcel.pricing.total)}</span>
                    <ChevronRight size={14} />
                  </LinkButton>
                ))}
            </div>
          </div>
          <footer className="dialog-footer">
            <Button variant="secondary" onClick={() => setCustomerId(null)}>
              Close profile
            </Button>
          </footer>
        </Modal>
      )}
      {/* Reuse the address form while persisting only to the explicit demo store. */}
      {selected && newAddress && (
        <AddressDialog
          onClose={() => setNewAddress(false)}
          onSave={(values) => {
            const address: Address = {
              id: crypto.randomUUID(),
              label: values.label,
              text: values.text ?? "Address not provided",
              latitude: null,
              longitude: null,
              distanceKm: 0,
              minutes: 0,
            };
            if (
              !commit(
                (current) => ({
                  ...current,
                  customers: current.customers.map((customer) =>
                    customer.id === selected.id
                      ? {
                          ...customer,
                          addresses: [...customer.addresses, address],
                        }
                      : customer,
                  ),
                }),
                "New demo address saved separately.",
              )
            )
              throw new Error("Unable to save the demo address.");
          }}
        />
      )}
      {selected && location && (
        <LocationDialog
          customer={selected}
          address={location}
          onClose={() => setLocation(null)}
        />
      )}
    </>
  );
}

/** Selects private seller preferences or the existing demo seller directory. */
export function SellersScreen() {
  const { mode } = useActions();
  return mode === "authenticated" ? (
    <AccountSellersScreen />
  ) : (
    <DemoSellersScreen />
  );
}

/** Keeps sample parcel balances separate from real account seller preferences. */
function DemoSellersScreen() {
  const state = usePrototypeState();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Seller | "new" | null>(null);
  const sellers = state.sellers.filter((seller) =>
    `${seller.name} ${seller.contact}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        eyebrow="GOOD PARTNERS. CLEAR PREFERENCES."
        title="Your sellers"
        description="Set how every seller quotes their parcels, so the delivery fee is always clear."
      >
        <Button onClick={() => setEditing("new")}>
          <Plus size={17} />
          Add seller
        </Button>
      </PageHeading>
      <SellerPricingGuide />
      <div className="directory-toolbar">
        <div className="input-with-icon">
          <Search size={17} />
          <input
            placeholder="Search sellers..."
            aria-label="Search sellers"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <Badge tone="gray">{state.sellers.length} seller(s)</Badge>
      </div>
      <div className="seller-directory">
        {sellers.map((seller) => (
          <section className="card seller-directory-card" key={seller.id}>
            <div className="seller-directory-head">
              <Avatar name={seller.name} color={seller.color} />
              <button
                className="icon-button"
                aria-label={`Edit ${seller.name}`}
                onClick={() => setEditing(seller)}
              >
                <Pencil size={17} />
              </button>
            </div>
            <h2>{seller.name}</h2>
            <p>{seller.contact || "Seller contact not set"}</p>
            <Badge tone={seller.mode === "included" ? "green" : "blue"}>
              Delivery fee {seller.mode}
            </Badge>
            <div className="seller-directory-stats">
              <span>
                Default rider fee<strong>{money(seller.fee)}</strong>
              </span>
              <span>
                Parcels in workspace
                <strong>
                  {
                    state.parcels.filter(
                      (parcel) => parcel.sellerId === seller.id,
                    ).length
                  }
                </strong>
              </span>
              <span>
                Seller share outstanding
                <strong>{money(sellerBalance(state, seller.id))}</strong>
              </span>
            </div>
            <div className="seller-directory-actions">
              <Button variant="secondary" onClick={() => setEditing(seller)}>
                Preferences
                <ChevronRight size={14} />
              </Button>
              <LinkButton href="/collections" variant="ghost">
                View balance
              </LinkButton>
            </div>
          </section>
        ))}
      </div>
      {!sellers.length && (
        <EmptyState
          title="No matching sellers"
          action={<Button onClick={() => setEditing("new")}>Add seller</Button>}
        >
          Add a seller with explicit fee preferences.
        </EmptyState>
      )}
      {editing && (
        <SellerDialog
          seller={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
