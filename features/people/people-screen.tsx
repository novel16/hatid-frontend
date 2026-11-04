"use client";

import { useEffect, useState } from "react";
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
  Store,
  Users,
} from "lucide-react";
import { money, sellerBalance } from "@/lib/prototype/domain";
import { usePrototypeState } from "@/lib/prototype/store";
import type { Seller } from "@/lib/prototype/types";
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
  type AddressValues,
  type CustomerValues,
} from "@/features/customers/customer-dialog";
import { SellerDialog } from "@/features/sellers/seller-dialog";
import { Pagination, PaginationEntries, usePagination } from "@/components/pagination";
import {
  directoryPath,
  errorMessage,
  type ApiAddress,
  type ApiCustomer,
  type DirectoryFilters,
  type PaginatedResponse,
} from "@/lib/api";

/** Shares private server search, paging and refresh without mixing directory-specific writes. */
function useAccountDirectory<T>(kind: "customers" | "sellers") {
  const { request } = useActions();
  const [filters, setFilters] = useState<
    DirectoryFilters & { revision: number }
  >({
    query: "",
    archived: false,
    page: 1,
    perPage: 10,
    revision: 0,
  });
  const [result, setResult] = useState<PaginatedResponse<T> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /** Fetch only the requested account page; older responses cannot replace newer filters. */
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    /** Preserve the API's full total and metadata without slicing its already-paginated data. */
    async function load() {
      try {
        const response = await request<PaginatedResponse<T>>(
          directoryPath(kind, filters),
          "GET",
          undefined,
          { signal: controller.signal },
        );
        if (!active) return;
        const lastPage = Math.max(1, response.meta.last_page);
        if (filters.page > lastPage) {
          setFilters({ ...filters, page: lastPage });
          return;
        }
        setResult(response);
        setLoading(false);
      } catch (cause) {
        if (active) {
          setError(errorMessage(cause, `Unable to load your ${kind}.`));
          setLoading(false);
        }
      }
    }
    const timer = setTimeout(
      /** Debounce typing without loading the entire account directory. */ () => {
        void load();
      },
      filters.query ? 250 : 0,
    );
    /** Account changes, navigation and superseded searches invalidate this response. */
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [request, filters, kind]);

  /** Starts loading immediately so stale rows disappear while filters or page size change. */
  function updateFilters(values: Partial<typeof filters> = {}) {
    setLoading(true);
    setError("");
    setFilters(
      /** Preserve unaffected filters while permitting an explicit retry of the same query. */
      (current) => ({ ...current, ...values, revision: current.revision + 1 }),
    );
  }

  /** New records appear in the active list; other mutations preserve the search. */
  function reload(resetFilters = false) {
    updateFilters(resetFilters ? { query: "", archived: false, page: 1 } : {});
  }

  const controls = {
    page: result?.meta.current_page ?? filters.page,
    perPage: filters.perPage,
    total: result?.meta.total ?? 0,
    disabled: loading,
    onChange: updateFilters,
  };
  return { filters, result, loading, error, controls, updateFilters, reload };
}

/** The customer directory requires an account and never renders static prototype customers. */
export function CustomersScreen() {
  const { session } = useActions();
  if (session) return <AccountCustomersScreen key={session.user.id} />;
  return (
    <EmptyState
      title="Sign in to view your customers"
      action={<LinkButton href="/login">Sign in</LinkButton>}
    >
      Customer records are saved privately to your rider account.
    </EmptyState>
  );
}

/** Manages only the authenticated rider's real customers and separate delivery addresses. */
function AccountCustomersScreen() {
  const { request, notify } = useActions();
  const { filters, result, loading, error, controls, updateFilters, reload } =
    useAccountDirectory<ApiCustomer>("customers");
  const customers = result?.data ?? [];
  const meta = result?.meta;
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
    reload(creating);
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
      reload();
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
    reload();
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
      reload();
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
      {meta && !loading && !error && (
        <div className="section-summary">
          <Badge tone="green">
            <Users size={14} /> {meta.total.toLocaleString()} customers
          </Badge>
        </div>
      )}
      <Card>
        <div className="table-toolbar">
          <div className="toolbar-filters">
            <select
              aria-label="Customer record status"
              value={filters.archived ? "archived" : "active"}
              onChange={
                /** Status changes begin at the first matching page. */ (
                  event,
                ) =>
                  updateFilters({
                    archived: event.target.value === "archived",
                    page: 1,
                  })
              }
            >
              <option value="active">Active customers</option>
              <option value="archived">Archived customers</option>
            </select>
            <Button
              variant="ghost"
              disabled={loading}
              onClick={/** Refresh only on request. */ () => reload()}
            >
              <RefreshCw size={16} /> Refresh
            </Button>
          </div>
        </div>
        <div className="table-toolbar">
          <PaginationEntries {...controls} label="Customers pagination" />
          <div className="input-with-icon">
            <Search size={17} />
            <input
              type="search"
              aria-label="Search customer directory"
              placeholder="Search name, phone or address…"
              maxLength={100}
              value={filters.query}
              onChange={
                /** Search across all owned customers, starting on page one. */ (
                  event,
                ) => updateFilters({ query: event.target.value, page: 1 })
              }
            />
          </div>
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
              {!loading &&
                !error &&
                customers.map(
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
          {loading ? (
            <div className="card-body">
              <p role="status">Loading your customers…</p>
            </div>
          ) : error ? (
            <div className="card-body form-stack" role="alert">
              <p>{error}</p>
              <Button
                variant="secondary"
                onClick={
                  /** Retry without falling back to sample data. */ () =>
                    reload()
                }
              >
                Try again
              </Button>
            </div>
          ) : !customers.length ? (
            <EmptyState
              title={
                filters.archived
                  ? "No archived customers"
                  : "No matching customers"
              }
            >
              Try another search or add a customer.
            </EmptyState>
          ) : null}
        </div>
        {meta && !error && (
          <Pagination {...controls} label="Customers pagination" />
        )}
      </Card>

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

/** Keeps seller cards paginated without changing full-directory balances or preferences. */
export function SellersScreen() {
  const state = usePrototypeState();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Seller | "new" | null>(null);
  const sellers = state.sellers.filter((seller) =>
    `${seller.name} ${seller.contact}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const pagination = usePagination(sellers, query);
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
      <div className="seller-guide-banner">
        <span>
          <Store size={23} />
        </span>
        <div>
          <h3>Included or excluded? Set it once, review it on every parcel.</h3>
          <p>
            Included ₱115 with a ₱15 fee → collect ₱115, seller gets ₱100.
            Excluded ₱100 + ₱15 → the same ₱115 customer total.
          </p>
        </div>
      </div>
      <div className="directory-toolbar">
        <PaginationEntries
          {...pagination.controls}
          label="Sellers pagination"
        />
        <div className="input-with-icon">
          <Search size={17} />
          <input
            placeholder="Search sellers..."
            aria-label="Search sellers"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>
      <div className="seller-directory">
        {pagination.items.map((seller) => (
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
      <Pagination {...pagination.controls} label="Sellers pagination" />
      {editing && (
        <SellerDialog
          seller={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
