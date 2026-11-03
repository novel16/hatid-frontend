"use client";

import { useState } from "react";
import {
  Archive,
  ChevronRight,
  MapPin,
  MapPinOff,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useActions } from "@/components/providers";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Modal,
  PageHeading,
} from "@/components/ui";
import {
  errorMessage,
  type ApiAddress,
  type ApiCustomer,
  type ApiSeller,
  type DirectoryKind,
} from "@/lib/api";
import { money } from "@/lib/prototype/domain";
import {
  AddressDialog,
  CustomerDialog,
  type AddressValues,
  type CustomerValues,
} from "@/features/customers/customer-dialog";
import {
  SellerDialog,
  SellerPricingGuide,
  type SellerValues,
} from "@/features/sellers/seller-dialog";
import { useDirectory, type DirectoryList } from "./use-directory";

/** Makes the real account/demo boundary visible before users create records. */
function AccountDirectoryNote() {
  return (
    <div className="notice notice-muted account-directory-note">
      <ShieldCheck size={20} />
      <p>
        <strong>Private to your rider account.</strong> Changes save online.
        Demo parcel and delivery records remain separate.
      </p>
    </div>
  );
}

/** Reuses account-only search, archive filtering and refresh controls across both directories. */
function DirectoryControls({
  directory,
  kind,
}: {
  directory: DirectoryList<unknown>;
  kind: DirectoryKind;
}) {
  return (
    <div className="directory-toolbar account-directory-toolbar">
      <div className="input-with-icon">
        <Search size={17} />
        <input
          data-directory-search
          aria-label={"Search account " + kind}
          maxLength={100}
          placeholder={
            kind === "customers"
              ? "Search name, phone or address..."
              : "Search seller or contact..."
          }
          value={directory.query}
          onChange={
            /** Search only this account directory. */ (event) =>
              directory.search(event.target.value)
          }
        />
      </div>
      <div className="directory-status">
        <Field label="Show records">
          <select
            aria-label="Directory status"
            value={directory.archived ? "archived" : "active"}
            onChange={
              /** Switch between active and archived records. */ (event) =>
                directory.filterArchived(event.target.value === "archived")
            }
          >
            <option value="active">Active records</option>
            <option value="archived">Archived records</option>
          </select>
        </Field>
      </div>
      <Button
        variant="secondary"
        onClick={
          /** Retry or refresh the server listing. */ () => directory.reload()
        }
        disabled={directory.loading}
        aria-label="Refresh directory"
      >
        <RefreshCw size={16} />
        Refresh
      </Button>
    </div>
  );
}

/** Presents loading/retry/empty states without falling back to sample records. */
function DirectoryMessage({
  directory,
  kind,
}: {
  directory: DirectoryList<unknown>;
  kind: DirectoryKind;
}) {
  if (directory.loading)
    return (
      <div className="directory-message" role="status">
        Loading your {kind}…
      </div>
    );
  if (directory.error)
    return (
      <div className="form-error directory-message" role="alert">
        <p>{directory.error}</p>
        <Button
          variant="secondary"
          onClick={
            /** Retry or refresh the server listing. */ () => directory.reload()
          }
        >
          Try again
        </Button>
      </div>
    );
  if (!directory.items.length)
    return (
      <EmptyState
        title={
          directory.query
            ? "No matching " + kind
            : directory.archived
              ? "No archived " + kind
              : "Your " + kind + " directory is empty"
        }
      >
        {directory.archived
          ? "Archived records can be restored here."
          : "Try another search or add your first record."}
      </EmptyState>
    );
  return null;
}

/** Keeps server pagination consistent and prevents duplicate page requests while loading. */
function DirectoryPagination({
  directory,
}: {
  directory: DirectoryList<unknown>;
}) {
  if (!directory.meta || !directory.meta.total) return null;
  return (
    <div className="directory-pagination">
      <span className="small-muted">
        {directory.meta.total} record(s) · Page {directory.page} of{" "}
        {directory.meta.last_page}
      </span>
      <div>
        <Button
          variant="secondary"
          disabled={directory.loading || directory.page <= 1}
          onClick={
            /** Request the previous server page. */ () =>
              directory.changePage(directory.page - 1)
          }
        >
          Previous
        </Button>
        <Button
          variant="secondary"
          disabled={
            directory.loading || directory.page >= directory.meta.last_page
          }
          onClick={
            /** Request the next server page. */ () =>
              directory.changePage(directory.page + 1)
          }
        >
          Next
        </Button>
      </div>
    </div>
  );
}

/** Manages only the authenticated rider's real customers and separate delivery addresses. */
export function AccountCustomersScreen() {
  const directory = useDirectory<ApiCustomer>("customers");
  const { request, notify } = useActions();
  const [selected, setSelected] = useState<ApiCustomer | null>(null);
  const [editing, setEditing] = useState<ApiCustomer | "new" | null>(null);
  const [editingAddress, setEditingAddress] = useState<
    ApiAddress | "new" | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  /** Saves allowed identity fields without copying account records into the prototype store. */
  async function saveCustomer(values: CustomerValues) {
    if (!editing) return;
    const creating = editing === "new";
    const url = editing === "new" ? "/customers" : "/customers/" + editing.id;
    const { data } = await request<{ data: ApiCustomer }>(
      url,
      creating ? "POST" : "PATCH",
      values,
    );
    if (selected?.id === data.id) setSelected(data);
    directory.reload(creating);
    notify(creating ? "Customer saved to your account." : "Customer updated.");
  }

  /** Archives/restores a customer while retaining its identity and address history. */
  async function changeArchive(customer: ApiCustomer) {
    if (busy) return;
    setBusy(true);
    setActionError("");
    try {
      const restoring = !!customer.archived_at;
      await request(
        "/customers/" + customer.id + (restoring ? "/restore" : ""),
        restoring ? "POST" : "DELETE",
      );
      setSelected(null);
      directory.reload();
      notify(
        restoring
          ? "Customer restored."
          : "Customer archived. You can restore it from Archived records.",
      );
    } catch (cause) {
      setActionError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  /** Saves address text/label under the selected owned customer; GPS is never included. */
  async function saveAddress(values: AddressValues) {
    if (!selected || !editingAddress) return;
    const creating = editingAddress === "new";
    const url =
      "/customers/" +
      selected.id +
      "/addresses" +
      (editingAddress === "new" ? "" : "/" + editingAddress.id);
    const { data } = await request<{ data: ApiCustomer }>(
      url,
      creating ? "POST" : "PATCH",
      values,
    );
    setSelected(data);
    directory.reload();
    notify(creating ? "Separate address saved." : "Address details updated.");
  }

  /** Archives/restores one child address without changing other addresses or its GPS evidence. */
  async function changeAddressArchive(address: ApiAddress) {
    if (!selected || busy) return;
    setBusy(true);
    setActionError("");
    try {
      const restoring = !!address.archived_at;
      const url =
        "/customers/" +
        selected.id +
        "/addresses/" +
        address.id +
        (restoring ? "/restore" : "");
      await request(url, restoring ? "POST" : "DELETE");
      const { data } = await request<{ data: ApiCustomer }>(
        "/customers/" + selected.id,
      );
      setSelected(data);
      directory.reload();
      notify(restoring ? "Address restored." : "Address archived.");
    } catch (cause) {
      setActionError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  /** Clears customer-specific UI when the profile closes. */
  function closeProfile() {
    if (busy) return;
    setSelected(null);
    setEditingAddress(null);
    setActionError("");
  }

  return (
    <>
      <PageHeading
        eyebrow="FAMILIAR FACES, EASIER VISITS"
        title="Your customers"
        description="Private customer records, distinct addresses, and clear contact details."
      >
        <Button
          onClick={/** Open a fresh record form. */ () => setEditing("new")}
        >
          <Plus size={17} />
          Add customer
        </Button>
      </PageHeading>
      <AccountDirectoryNote />
      <DirectoryControls directory={directory} kind="customers" />
      <Card>
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
              {!directory.loading &&
                !directory.error &&
                directory.items.map(
                  /** Render one owned customer and its active addresses. */ (
                    customer,
                  ) => {
                    const addresses = customer.addresses.filter(
                      /** Keep separately archived addresses out of the active summary. */ (
                        address,
                      ) => !address.archived_at,
                    );
                    const hasPin = addresses.some(
                      /** Mark a location verified only when delivery evidence exists. */ (
                        address,
                      ) => !!address.verified_at,
                    );
                    return (
                      <tr key={customer.id}>
                        <td>
                          <button
                            className="customer-link"
                            onClick={
                              /** Open the selected customer with cleared action errors. */ () => {
                                setActionError("");
                                setSelected(customer);
                              }
                            }
                          >
                            <Avatar name={customer.name} />
                            <span>
                              <strong>{customer.name}</strong>
                              <small>
                                {addresses.length} active address(es)
                              </small>
                            </span>
                          </button>
                        </td>
                        <td>{customer.phone || "Not provided"}</td>
                        <td>
                          <span className="address-cell">
                            {addresses[0]?.text || "Address not provided"}
                          </span>
                        </td>
                        <td>
                          <Badge
                            tone={
                              customer.archived_at
                                ? "gray"
                                : hasPin
                                  ? "green"
                                  : "amber"
                            }
                          >
                            {customer.archived_at
                              ? "Archived"
                              : hasPin
                                ? "Pin verified"
                                : "No verified pin"}
                          </Badge>
                        </td>
                        <td>
                          <button
                            className="row-open"
                            aria-label={
                              "Open " + customer.name + "'s customer profile"
                            }
                            onClick={
                              /** Open the selected customer with cleared action errors. */ () => {
                                setActionError("");
                                setSelected(customer);
                              }
                            }
                          >
                            <ChevronRight size={18} />
                          </button>
                        </td>
                      </tr>
                    );
                  },
                )}
            </tbody>
          </table>
          <DirectoryMessage directory={directory} kind="customers" />
        </div>
      </Card>
      <DirectoryPagination directory={directory} />

      {editing && (
        <CustomerDialog
          open
          onClose={
            /** Clear the form state when its dialog closes. */ () =>
              setEditing(null)
          }
          onSave={saveCustomer}
          initialValues={
            editing === "new"
              ? undefined
              : { name: editing.name, phone: editing.phone }
          }
        />
      )}
      {selected && (
        <Modal
          open
          drawer
          onClose={closeProfile}
          title="Customer profile"
          description="Private account record. Addresses keep their separate identities."
        >
          <div className="dialog-body form-stack">
            <div className="person-profile">
              <Avatar name={selected.name} />
              <h3>{selected.name}</h3>
              <p>{selected.phone || "Phone not provided"}</p>
              <Badge tone={selected.archived_at ? "gray" : "green"}>
                {selected.archived_at ? "Archived customer" : "Active customer"}
              </Badge>
            </div>
            {actionError && (
              <div className="form-error" role="alert">
                {actionError}
              </div>
            )}
            <div className="section-title">
              <h3>Delivery addresses</h3>
              {!selected.archived_at && (
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={
                    /** Add a separate address under this customer. */ () =>
                      setEditingAddress("new")
                  }
                >
                  <Plus size={15} />
                  Add address
                </Button>
              )}
            </div>
            {selected.addresses.map(
              /** Render each address with its independent archive state. */ (
                address,
              ) => (
                <div
                  className="address-card account-address-card"
                  key={address.id}
                >
                  <div>
                    <span>
                      {address.verified_at ? (
                        <MapPin size={19} />
                      ) : (
                        <MapPinOff size={19} />
                      )}
                    </span>
                    <div>
                      <h4>{address.label}</h4>
                      <p>{address.text || "Address not provided"}</p>
                      <Badge
                        tone={
                          address.archived_at
                            ? "gray"
                            : address.verified_at
                              ? "green"
                              : "amber"
                        }
                      >
                        {address.archived_at
                          ? "Archived address"
                          : address.verified_at
                            ? "Verified pin saved"
                            : "No verified GPS pin"}
                      </Badge>
                    </div>
                  </div>
                  {!selected.archived_at && (
                    <div className="account-address-actions">
                      {!address.archived_at && (
                        <Button
                          variant="ghost"
                          disabled={busy}
                          aria-label={"Edit " + address.label + " address"}
                          onClick={
                            /** Edit only this address metadata. */ () =>
                              setEditingAddress(address)
                          }
                        >
                          <Pencil size={14} />
                          Edit
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        disabled={busy}
                        aria-label={
                          (address.archived_at ? "Restore " : "Archive ") +
                          address.label +
                          " address"
                        }
                        onClick={
                          /** Archive or restore this address through its owned parent. */ () =>
                            void changeAddressArchive(address)
                        }
                      >
                        {address.archived_at ? (
                          <RotateCcw size={14} />
                        ) : (
                          <Archive size={14} />
                        )}
                        {address.archived_at ? "Restore" : "Archive"}
                      </Button>
                    </div>
                  )}
                </div>
              ),
            )}
            {!selected.addresses.length && (
              <p className="small-muted">
                No addresses added yet. An address can be saved without a GPS
                pin.
              </p>
            )}
            <div className="notice notice-muted">
              <MapPinOff size={18} />
              <p>
                Verified GPS follows a successful delivery. Editing an address
                here changes only its label and text.
              </p>
            </div>
          </div>
          <footer className="dialog-footer account-profile-actions">
            {!selected.archived_at && (
              <Button
                variant="secondary"
                disabled={busy}
                onClick={
                  /** Edit the selected customer identity. */ () =>
                    setEditing(selected)
                }
              >
                <Pencil size={15} />
                Edit customer
              </Button>
            )}
            <Button
              variant="secondary"
              disabled={busy}
              onClick={
                /** Archive or restore this customer. */ () =>
                  void changeArchive(selected)
              }
            >
              {selected.archived_at ? (
                <RotateCcw size={15} />
              ) : (
                <Archive size={15} />
              )}
              {busy
                ? "Saving…"
                : selected.archived_at
                  ? "Restore customer"
                  : "Archive customer"}
            </Button>
            <Button variant="ghost" disabled={busy} onClick={closeProfile}>
              Close
            </Button>
          </footer>
        </Modal>
      )}
      {selected && editingAddress && (
        <AddressDialog
          onClose={
            /** Clear the address form when it closes. */ () =>
              setEditingAddress(null)
          }
          onSave={saveAddress}
          initialValues={
            editingAddress === "new"
              ? undefined
              : { label: editingAddress.label, text: editingAddress.text }
          }
        />
      )}
    </>
  );
}

/** Manages the rider's real seller fee defaults without fabricating parcel/balance statistics. */
export function AccountSellersScreen() {
  const directory = useDirectory<ApiSeller>("sellers");
  const { request, notify } = useActions();
  const [editing, setEditing] = useState<ApiSeller | "new" | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  /** Saves allowed preferences in centavos and keeps prototype parcel prices untouched. */
  async function saveSeller(values: SellerValues) {
    if (!editing) return;
    const creating = editing === "new";
    await request(
      "/sellers" + (editing === "new" ? "" : "/" + editing.id),
      creating ? "POST" : "PATCH",
      values,
    );
    directory.reload(creating);
    notify(
      creating
        ? "Seller saved to your account."
        : "Seller defaults updated. Existing parcel prices remain unchanged.",
    );
  }

  /** Archives/restores a seller without deleting its saved preferences. */
  async function changeArchive(seller: ApiSeller) {
    if (busy) return;
    setBusy(true);
    setActionError("");
    try {
      const restoring = !!seller.archived_at;
      await request(
        "/sellers/" + seller.id + (restoring ? "/restore" : ""),
        restoring ? "POST" : "DELETE",
      );
      directory.reload();
      notify(
        restoring
          ? "Seller restored."
          : "Seller archived. You can restore it from Archived records.",
      );
    } catch (cause) {
      setActionError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeading
        eyebrow="GOOD PARTNERS. CLEAR PREFERENCES."
        title="Your sellers"
        description="Your private seller directory and explicit delivery fee preferences."
      >
        <Button
          onClick={/** Open a fresh record form. */ () => setEditing("new")}
        >
          <Plus size={17} />
          Add seller
        </Button>
      </PageHeading>
      <AccountDirectoryNote />
      <SellerPricingGuide />
      <DirectoryControls directory={directory} kind="sellers" />
      {actionError && (
        <div className="form-error" role="alert">
          {actionError}
        </div>
      )}
      <div className="seller-directory">
        {!directory.loading &&
          !directory.error &&
          directory.items.map(
            /** Render one owned seller without demo balances. */ (seller) => (
              <section className="card seller-directory-card" key={seller.id}>
                <div className="seller-directory-head">
                  <Avatar name={seller.name} color="purple" />
                  {!seller.archived_at && (
                    <button
                      className="icon-button"
                      aria-label={"Edit " + seller.name}
                      onClick={
                        /** Open this seller’s saved fee defaults. */ () =>
                          setEditing(seller)
                      }
                      disabled={busy}
                    >
                      <Pencil size={17} />
                    </button>
                  )}
                </div>
                <h2>{seller.name}</h2>
                <p>{seller.contact || "Seller contact not set"}</p>
                <Badge
                  tone={
                    seller.archived_at
                      ? "gray"
                      : seller.mode === "included"
                        ? "green"
                        : "blue"
                  }
                >
                  {seller.archived_at
                    ? "Archived"
                    : "Delivery fee " + seller.mode}
                </Badge>
                <div className="seller-directory-stats">
                  <span>
                    Default rider fee<strong>{money(seller.fee)}</strong>
                  </span>
                </div>
                <div className="seller-directory-actions">
                  {!seller.archived_at && (
                    <Button
                      variant="secondary"
                      onClick={
                        /** Open this seller’s saved fee defaults. */ () =>
                          setEditing(seller)
                      }
                      disabled={busy}
                    >
                      Preferences
                      <ChevronRight size={14} />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    disabled={busy}
                    aria-label={
                      (seller.archived_at ? "Restore " : "Archive ") +
                      seller.name
                    }
                    onClick={
                      /** Archive or restore this seller preference record. */ () =>
                        void changeArchive(seller)
                    }
                  >
                    {seller.archived_at ? (
                      <RotateCcw size={14} />
                    ) : (
                      <Archive size={14} />
                    )}
                    {seller.archived_at ? "Restore" : "Archive"}
                  </Button>
                </div>
              </section>
            ),
          )}
      </div>
      <DirectoryMessage directory={directory} kind="sellers" />
      <DirectoryPagination directory={directory} />
      {editing && (
        <SellerDialog
          onClose={
            /** Clear the form state when its dialog closes. */ () =>
              setEditing(null)
          }
          onSave={saveSeller}
          seller={
            editing === "new"
              ? undefined
              : {
                  ...editing,
                  id: String(editing.id),
                  contact: editing.contact ?? "",
                  color: "purple",
                }
          }
        />
      )}
    </>
  );
}
