export type FeeMode = "included" | "excluded";
export type PaymentMethod = "cash" | "gcash";
export type ParcelStatus =
  "pending" | "delivered" | "held" | "failed" | "returned";

export interface Pricing {
  mode: FeeMode;
  quote: number;
  fee: number;
  total: number;
  sellerShare: number;
}

export interface Address {
  id: string;
  label: string;
  text: string;
  latitude: number | null;
  longitude: number | null;
  verifiedAt?: string;
  distanceKm: number;
  minutes: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  color: string;
  addresses: Address[];
}

export interface Seller {
  id: string;
  name: string;
  contact: string;
  mode: FeeMode;
  fee: number;
  color: string;
}

export interface Batch {
  id: string;
  name: string;
  start: string;
  end: string;
}

export interface Receipt {
  method: PaymentMethod;
  amount: number;
  confirmedAt: string;
}

export interface Attempt {
  id: string;
  outcome: ParcelStatus | "correction";
  note: string;
  at: string;
}

export interface Parcel {
  id: string;
  reference: string;
  customerId: string;
  addressId: string;
  sellerId: string;
  batchId: string;
  description: string;
  expectedMethod: PaymentMethod;
  pricing: Pricing;
  overrideReason?: string;
  status: ParcelStatus;
  receipt: Receipt | null;
  retryAt?: string;
  note: string;
  attempts: Attempt[];
}

export interface Remittance {
  id: string;
  sellerId: string;
  method: PaymentMethod;
  amount: number;
  at: string;
  reference: string;
  allocations: { parcelId: string; amount: number }[];
}

export interface Activity {
  id: string;
  title: string;
  detail: string;
  at: string;
  type: "delivery" | "parcel" | "money" | "location" | "notice";
  href: string;
}

export interface PrototypeState {
  version: 1;
  customers: Customer[];
  sellers: Seller[];
  batches: Batch[];
  parcels: Parcel[];
  remittances: Remittance[];
  activity: Activity[];
  selectedBatchId: string;
  manualNextStop: string | null;
  offline: boolean;
  pendingChanges: number;
  notificationsRead: boolean;
  settings: {
    riderName: string;
    phone: string;
    deliveryAlerts: boolean;
    collectionAlerts: boolean;
    compactView: boolean;
  };
}

export interface Stop {
  key: string;
  customer: Customer;
  address: Address;
  parcels: Parcel[];
  status: ParcelStatus | "partial";
}
