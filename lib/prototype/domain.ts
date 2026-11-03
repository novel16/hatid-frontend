import type {
  Activity,
  Address,
  Customer,
  FeeMode,
  Parcel,
  PaymentMethod,
  Pricing,
  PrototypeState,
  Remittance,
  Seller,
  Stop,
} from "./types";

export function priceParcel(
  quote: number,
  fee: number,
  mode: FeeMode,
): Pricing {
  if (![quote, fee].every(Number.isSafeInteger) || quote <= 0 || fee < 0) {
    throw new Error("Enter a valid parcel amount and delivery fee.");
  }
  if (mode === "included" && fee > quote) {
    throw new Error(
      "An included delivery fee cannot exceed the parcel amount.",
    );
  }
  const total = mode === "included" ? quote : quote + fee;
  if (!Number.isSafeInteger(total))
    throw new Error("The parcel amount is too large.");
  return { quote, fee, mode, total, sellerShare: total - fee };
}

export function parseMoney(value: string): number {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim()))
    throw new Error("Enter an amount with up to two decimal places.");
  const [whole, decimal = ""] = value.trim().split(".");
  const amount = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
  if (!Number.isSafeInteger(amount))
    throw new Error("The amount is too large.");
  return amount;
}

/** Formats centavo amounts for display throughout the rider workspace. */
export function money(cents: number): string {
  const whole = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(Math.trunc(cents / 100));
  const fraction = Math.abs(cents % 100);
  return fraction ? whole + "." + String(fraction).padStart(2, "0") : whole;
}

/** Formats a nonnegative centavo fee for an editable decimal input without float rounding. */
export function moneyInput(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents < 0)
    throw new Error("Enter a valid nonnegative fee.");
  return Math.trunc(cents / 100) + "." + String(cents % 100).padStart(2, "0");
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
}

export function formatDate(value: string, withTime = false): string {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
    timeZone: "Asia/Manila",
  }).format(new Date(value));
}

export function eligible(parcel: Parcel, at = new Date()): boolean {
  return (
    parcel.status === "pending" ||
    (parcel.status === "held" &&
      !!parcel.retryAt &&
      new Date(parcel.retryAt) <= at)
  );
}

export function getStops(
  state: PrototypeState,
  batchId = state.selectedBatchId,
): Stop[] {
  const grouped = new Map<string, Stop>();
  for (const parcel of state.parcels.filter(
    (item) => item.batchId === batchId,
  )) {
    const key = `${parcel.customerId}:${parcel.addressId}`;
    const customer = state.customers.find(
      (item) => item.id === parcel.customerId,
    );
    const address = customer?.addresses.find(
      (item) => item.id === parcel.addressId,
    );
    if (!customer || !address) continue;
    const stop = grouped.get(key) ?? {
      key,
      customer,
      address,
      parcels: [],
      status: parcel.status,
    };
    stop.parcels.push(parcel);
    grouped.set(key, stop);
  }
  return [...grouped.values()].map((stop) => {
    const statuses = stop.parcels.map((parcel) => parcel.status);
    const status = statuses.every((item) => item === statuses[0])
      ? statuses[0]
      : statuses.includes("delivered")
        ? "partial"
        : statuses.includes("pending")
          ? "pending"
          : statuses[0];
    return { ...stop, status };
  });
}

export function hasRoadEstimate(address: Address): boolean {
  return (
    Number.isFinite(address.distanceKm) &&
    address.distanceKm > 0 &&
    Number.isFinite(address.minutes) &&
    address.minutes > 0
  );
}

export function recommendedStops(
  state: PrototypeState,
  at = new Date(),
): Stop[] {
  if (state.offline) return [];
  return getStops(state)
    .filter(
      (stop) =>
        stop.address.latitude !== null &&
        stop.address.longitude !== null &&
        hasRoadEstimate(stop.address) &&
        stop.parcels.some((parcel) => eligible(parcel, at)),
    )
    .sort((a, b) => a.address.distanceKm - b.address.distanceKm)
    .slice(0, 5)
    .sort(
      (a, b) =>
        a.address.minutes - b.address.minutes ||
        a.address.distanceKm - b.address.distanceKm,
    );
}

export function chosenStop(state: PrototypeState): Stop | undefined {
  const manual = getStops(state).find(
    (stop) =>
      stop.key === state.manualNextStop &&
      stop.parcels.some((parcel) => eligible(parcel)),
  );
  return manual ?? recommendedStops(state)[0];
}

export function selectBatch(
  state: PrototypeState,
  batchId: string,
): PrototypeState {
  if (!state.batches.some((batch) => batch.id === batchId))
    throw new Error("Weekly batch not found.");
  return { ...state, selectedBatchId: batchId, manualNextStop: null };
}

export function selectNextStop(
  state: PrototypeState,
  key: string,
  batchId = state.selectedBatchId,
): PrototypeState {
  const next = selectBatch(state, batchId);
  const stop = getStops(next).find((item) => item.key === key);
  if (!stop || !stop.parcels.some((parcel) => eligible(parcel))) {
    throw new Error("This stop has no parcels ready for delivery.");
  }
  return { ...next, manualNextStop: key };
}

export function outstandingForParcel(
  state: PrototypeState,
  parcel: Parcel,
): number {
  if (parcel.status !== "delivered" || !parcel.receipt) return 0;
  const remitted = state.remittances.reduce(
    (sum, remit) =>
      sum +
      remit.allocations
        .filter((allocation) => allocation.parcelId === parcel.id)
        .reduce((total, allocation) => total + allocation.amount, 0),
    0,
  );
  return Math.max(0, parcel.pricing.sellerShare - remitted);
}

export function sellerBalance(state: PrototypeState, sellerId: string): number {
  return state.parcels
    .filter((parcel) => parcel.sellerId === sellerId)
    .reduce((sum, parcel) => sum + outstandingForParcel(state, parcel), 0);
}

export function totals(state: PrototypeState, batchId?: string) {
  const parcels = state.parcels.filter(
    (parcel) => !batchId || parcel.batchId === batchId,
  );
  const delivered = parcels.filter(
    (parcel) => parcel.status === "delivered" && parcel.receipt,
  );
  return {
    count: parcels.length,
    delivered: delivered.length,
    pending: parcels.filter((parcel) => parcel.status === "pending").length,
    held: parcels.filter((parcel) => parcel.status === "held").length,
    failed: parcels.filter((parcel) => parcel.status === "failed").length,
    cash: delivered
      .filter((parcel) => parcel.receipt?.method === "cash")
      .reduce((sum, parcel) => sum + parcel.pricing.total, 0),
    gcash: delivered
      .filter((parcel) => parcel.receipt?.method === "gcash")
      .reduce((sum, parcel) => sum + parcel.pricing.total, 0),
    fees: delivered.reduce((sum, parcel) => sum + parcel.pricing.fee, 0),
    outstanding: parcels.reduce(
      (sum, parcel) => sum + outstandingForParcel(state, parcel),
      0,
    ),
  };
}

function withActivity(state: PrototypeState, event: Activity): PrototypeState {
  const alertEnabled =
    event.type === "money"
      ? state.settings.collectionAlerts
      : state.settings.deliveryAlerts;
  return {
    ...state,
    notificationsRead: alertEnabled ? false : state.notificationsRead,
    activity: [event, ...state.activity].slice(0, 50),
  };
}

export function addParcel(
  state: PrototypeState,
  parcel: Parcel,
): PrototypeState {
  const seller = state.sellers.find((item) => item.id === parcel.sellerId);
  const customer = state.customers.find(
    (item) => item.id === parcel.customerId,
  );
  if (
    !seller ||
    !customer?.addresses.some((address) => address.id === parcel.addressId)
  )
    throw new Error("Choose a seller and a customer address.");
  if (!state.batches.some((batch) => batch.id === parcel.batchId))
    throw new Error("Choose a valid weekly batch.");
  if (
    (seller.mode !== parcel.pricing.mode ||
      seller.fee !== parcel.pricing.fee) &&
    !parcel.overrideReason?.trim()
  )
    throw new Error(
      "Add a reason for changing the seller's pricing preference.",
    );
  if (state.parcels.some((item) => item.id === parcel.id)) return state;
  const pricing = priceParcel(
    parcel.pricing.quote,
    parcel.pricing.fee,
    parcel.pricing.mode,
  );
  return withActivity(
    {
      ...state,
      parcels: [
        { ...parcel, pricing, status: "pending", receipt: null },
        ...state.parcels,
      ],
    },
    {
      id: `add-${parcel.id}`,
      title: "New parcel added",
      detail: `${parcel.reference} · ${customer.name}`,
      at: new Date().toISOString(),
      type: "parcel",
      href: `/deliveries/${parcel.id}`,
    },
  );
}

export function deliverParcels(
  state: PrototypeState,
  ids: string[],
  methods: Record<string, PaymentMethod>,
  operationId: string,
  at: string,
): PrototypeState {
  if (state.activity.some((event) => event.id === operationId)) return state;
  const uniqueIds = [...new Set(ids)];
  const selected = uniqueIds.map((id) =>
    state.parcels.find((parcel) => parcel.id === id),
  );
  if (
    !selected.length ||
    selected.some((parcel) => !parcel || !eligible(parcel, new Date(at)))
  )
    throw new Error(
      "Select ready parcels; resume any scheduled holds before confirming.",
    );
  if (
    selected.some(
      (parcel) => !parcel || !["cash", "gcash"].includes(methods[parcel.id]),
    )
  )
    throw new Error("Confirm how each parcel was paid.");
  const parcels = state.parcels.map((parcel) =>
    !uniqueIds.includes(parcel.id)
      ? parcel
      : {
          ...parcel,
          status: "delivered" as const,
          receipt: {
            method: methods[parcel.id],
            amount: parcel.pricing.total,
            confirmedAt: at,
          },
          attempts: [
            ...parcel.attempts,
            {
              id: operationId,
              outcome: "delivered" as const,
              note: "Rider confirmed delivery and full payment receipt.",
              at,
            },
          ],
        },
  );
  return withActivity(
    { ...state, parcels },
    {
      id: operationId,
      title: `${selected.length} parcel${selected.length === 1 ? "" : "s"} delivered`,
      detail: "Payment recorded · rider fee retained",
      at,
      type: "delivery",
      href: `/deliveries/${uniqueIds[0]}`,
    },
  );
}

export function recordOutcome(
  state: PrototypeState,
  ids: string[],
  outcome: "held" | "failed" | "returned" | "pending",
  note: string,
  retryAt?: string,
): PrototypeState {
  if (!note.trim()) throw new Error("Choose a reason or add a note.");
  const selected = state.parcels.filter((parcel) => ids.includes(parcel.id));
  if (
    !selected.length ||
    selected.some(
      (parcel) => parcel.status === "delivered" || parcel.status === "returned",
    )
  )
    throw new Error("Completed parcels cannot be changed through this action.");
  const at = new Date().toISOString();
  const operationId = crypto.randomUUID();
  const parcels = state.parcels.map((parcel) =>
    !ids.includes(parcel.id)
      ? parcel
      : {
          ...parcel,
          status: outcome,
          retryAt,
          receipt: null,
          attempts: [
            ...parcel.attempts,
            { id: operationId, outcome, note, at },
          ],
        },
  );
  return withActivity(
    { ...state, parcels },
    {
      id: operationId,
      title:
        outcome === "pending"
          ? "Delivery ready to retry"
          : `Delivery marked ${outcome}`,
      detail: note,
      at,
      type: "notice",
      href: `/deliveries/${ids[0]}`,
    },
  );
}

export function recordRemittance(
  state: PrototypeState,
  input: Omit<Remittance, "allocations">,
): PrototypeState {
  if (state.offline)
    throw new Error("Reconnect before confirming a remittance.");
  if (state.remittances.some((item) => item.id === input.id)) return state;
  if (!["cash", "gcash"].includes(input.method))
    throw new Error("Choose cash or externally completed GCash.");
  if (
    !Number.isSafeInteger(input.amount) ||
    input.amount <= 0 ||
    input.amount > sellerBalance(state, input.sellerId)
  )
    throw new Error(
      "Enter an amount within this seller's outstanding balance.",
    );
  let remaining = input.amount;
  const allocations: Remittance["allocations"] = [];
  const owed = state.parcels
    .filter((parcel) => parcel.sellerId === input.sellerId && parcel.receipt)
    .sort((a, b) =>
      (a.receipt?.confirmedAt ?? "").localeCompare(
        b.receipt?.confirmedAt ?? "",
      ),
    );
  for (const parcel of owed) {
    if (remaining === 0) break;
    const amount = Math.min(remaining, outstandingForParcel(state, parcel));
    if (amount > 0) allocations.push({ parcelId: parcel.id, amount });
    remaining -= amount;
  }
  if (remaining !== 0)
    throw new Error("The seller balance changed. Review the amount again.");
  return withActivity(
    {
      ...state,
      remittances: [{ ...input, allocations }, ...state.remittances],
    },
    {
      id: `remit-${input.id}`,
      title: `${money(input.amount)} remittance recorded`,
      detail:
        state.sellers.find((seller) => seller.id === input.sellerId)?.name ??
        "Seller",
      at: input.at,
      type: "money",
      href: "/collections",
    },
  );
}

export function createCustomer(
  state: PrototypeState,
  customer: Customer,
): PrototypeState {
  if (!customer.name.trim() || !customer.addresses.length)
    throw new Error("Enter a customer name and an address label.");
  if (
    customer.phone &&
    customer.phone !== "Not provided" &&
    state.customers.some((entry) => entry.phone === customer.phone)
  )
    throw new Error(
      "This phone number already belongs to a customer. Select that customer instead.",
    );
  return { ...state, customers: [...state.customers, customer] };
}

export function saveSeller(
  state: PrototypeState,
  seller: Seller,
): PrototypeState {
  if (
    !seller.name.trim() ||
    !Number.isSafeInteger(seller.fee) ||
    seller.fee < 0 ||
    !["included", "excluded"].includes(seller.mode)
  )
    throw new Error(
      "Enter a seller name, a valid fee and a pricing preference.",
    );
  const exists = state.sellers.some((entry) => entry.id === seller.id);
  return {
    ...state,
    sellers: exists
      ? state.sellers.map((entry) => (entry.id === seller.id ? seller : entry))
      : [...state.sellers, seller],
  };
}

export function saveAddressPin(
  state: PrototypeState,
  customerId: string,
  addressId: string,
  latitude: number,
  longitude: number,
): PrototypeState {
  const customer = state.customers.find((item) => item.id === customerId);
  const address = customer?.addresses.find((item) => item.id === addressId);
  if (
    !address ||
    (!address.verifiedAt &&
      !state.parcels.some(
        (parcel) =>
          parcel.customerId === customerId &&
          parcel.addressId === addressId &&
          parcel.status === "delivered",
      ))
  )
    throw new Error("Complete a delivery before saving a verified location.");
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  )
    throw new Error("Enter valid latitude and longitude coordinates.");
  const at = new Date().toISOString();
  const customers = state.customers.map((item) =>
    item.id !== customerId
      ? item
      : {
          ...item,
          addresses: item.addresses.map((entry) =>
            entry.id !== addressId
              ? entry
              : {
                  ...entry,
                  latitude,
                  longitude,
                  verifiedAt: at,
                  distanceKm:
                    entry.latitude === latitude && entry.longitude === longitude
                      ? entry.distanceKm
                      : 0,
                  minutes:
                    entry.latitude === latitude && entry.longitude === longitude
                      ? entry.minutes
                      : 0,
                },
          ),
        },
  );
  return withActivity(
    { ...state, customers },
    {
      id: crypto.randomUUID(),
      title: "Customer location confirmed",
      detail: `${customer?.name} · ${address.label}`,
      at,
      type: "location",
      href: "/customers",
    },
  );
}
