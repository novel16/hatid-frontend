import { priceParcel } from "./domain.ts";
import type { Customer, Parcel, PrototypeState, Remittance } from "./types";

const names = [
  "Maria Santos",
  "Jose Reyes",
  "Ana Cruz",
  "Carlo Mendoza",
  "Liza Garcia",
  "Ramon Flores",
  "Bea Lim",
  "Nora Dela Cruz",
  "Miguel Ramos",
  "Isabel Torres",
  "Sofia Tan",
];
const colors = [
  "sage",
  "blue",
  "peach",
  "purple",
  "amber",
  "sage",
  "blue",
  "peach",
  "purple",
  "amber",
  "sage",
];
const addresses = [
  "18 Mabini Street, San Isidro",
  "24 Rizal Street, Magugpo East",
  "8 Bonifacio Street, San Isidro",
  "12 Narra Street, Apokon",
  "6 Laurel Avenue, Magugpo North",
  "11 Sampaguita Street, San Miguel",
  "22 Acacia Street, Magugpo East",
  "Address to be confirmed",
  "15 Luna Street, Magugpo South",
  "9 Talisay Street, San Isidro",
  "28 Mango Street, Apokon",
];
const distance = [1.1, 1.8, 0.8, 2.4, 2.1, 3.4, 1.3, 0, 3.2, 1.6, 2.8];
const minutes = [5, 8, 4, 11, 9, 14, 6, 0, 12, 6, 10];

const customers: Customer[] = names.map((name, index) => ({
  id: `c${index + 1}`,
  name,
  phone: `0917 XXX ${String(101 + index).padStart(4, "0")}`,
  color: colors[index],
  addresses: [
    {
      id: `a${index + 1}`,
      label: "Home",
      text: addresses[index],
      latitude: index === 7 ? null : 7.4475 + index * 0.001,
      longitude: index === 7 ? null : 125.8078 + index * 0.001,
      verifiedAt: index === 7 ? undefined : "2026-10-24T09:00:00+08:00",
      distanceKm: distance[index],
      minutes: minutes[index],
    },
  ],
}));

type SeedInput = {
  customer: number;
  seller: number;
  quote: number;
  status?: Parcel["status"];
  method?: "cash" | "gcash";
  description?: string;
};
const inputs: SeedInput[] = [
  { customer: 1, seller: 1, quote: 115, description: "Skincare essentials" },
  {
    customer: 1,
    seller: 2,
    quote: 200,
    method: "gcash",
    description: "Everyday tote bag",
  },
  { customer: 2, seller: 1, quote: 250, description: "Kitchen organizer" },
  {
    customer: 3,
    seller: 1,
    quote: 115,
    status: "delivered",
    description: "Beauty bundle",
  },
  {
    customer: 3,
    seller: 2,
    quote: 300,
    status: "delivered",
    method: "gcash",
    description: "Cotton basics",
  },
  {
    customer: 4,
    seller: 1,
    quote: 185,
    status: "held",
    description: "Home essentials",
  },
  { customer: 5, seller: 1, quote: 430, description: "Gift set" },
  {
    customer: 6,
    seller: 3,
    quote: 100,
    status: "failed",
    description: "Phone accessories",
  },
  {
    customer: 7,
    seller: 3,
    quote: 150,
    status: "delivered",
    description: "Handmade keychain set",
  },
  { customer: 8, seller: 1, quote: 100, description: "Personal care kit" },
  { customer: 9, seller: 1, quote: 200, description: "Desk accessories" },
  { customer: 10, seller: 1, quote: 315, description: "Weekend essentials" },
  { customer: 11, seller: 3, quote: 150, description: "Canvas pouch" },
];

const sellers: PrototypeState["sellers"] = [
  {
    id: "s1",
    name: "Aling Nena's Shop",
    contact: "Nena Bautista",
    mode: "included",
    fee: 1500,
    color: "peach",
  },
  {
    id: "s2",
    name: "MNL Finds",
    contact: "Jessa Rivera",
    mode: "excluded",
    fee: 2000,
    color: "purple",
  },
  {
    id: "s3",
    name: "The Little Local",
    contact: "Patricia Lim",
    mode: "excluded",
    fee: 1500,
    color: "blue",
  },
];

const parcels: Parcel[] = inputs.map((input, index) => {
  const seller = sellers[input.seller - 1];
  const pricing = priceParcel(input.quote * 100, seller.fee, seller.mode);
  const status = input.status ?? "pending";
  const at = `2026-11-01T08:${String(10 + index * 2).padStart(2, "0")}:00+08:00`;
  return {
    id: `p${index + 1}`,
    reference: `HTD-${String(2401 + index)}`,
    customerId: `c${input.customer}`,
    addressId: `a${input.customer}`,
    sellerId: seller.id,
    batchId: "batch-44",
    description: input.description ?? "Parcel",
    expectedMethod: input.method ?? "cash",
    pricing,
    status,
    receipt:
      status === "delivered"
        ? {
            method: input.method ?? "cash",
            amount: pricing.total,
            confirmedAt: at,
          }
        : null,
    retryAt: status === "held" ? "2026-11-02T16:00:00+08:00" : undefined,
    note:
      status === "held"
        ? "Customer requested delivery tomorrow after 4 PM."
        : status === "failed"
          ? "Customer could not be reached. No payment received."
          : "",
    attempts:
      status === "delivered"
        ? [
            {
              id: `seed-${index}`,
              outcome: "delivered",
              note: "Rider confirmed handover and payment receipt.",
              at,
            },
          ]
        : status === "failed" || status === "held"
          ? [
              {
                id: `seed-${index}`,
                outcome: status,
                note:
                  status === "held"
                    ? "Customer requested a later delivery."
                    : "No answer after two call attempts.",
                at,
              },
            ]
          : [],
  };
});

const historicalRemittances: Remittance[] = [];
[
  { name: "Luna Mercado", quote: 18000, date: "2026-10-26" },
  { name: "Andre Villanueva", quote: 22000, date: "2026-10-27" },
  { name: "Ruby Morales", quote: 15000, date: "2026-10-28" },
  { name: "Patricia Diaz", quote: 30000, date: "2026-10-30" },
  { name: "Leo Castillo", quote: 25000, date: "2026-10-31" },
].forEach((sample, index) => {
  const number = customers.length + 1;
  const id = `p${parcels.length + 1}`;
  const addressId = `a${number}`;
  const at = `${sample.date}T15:30:00+08:00`;
  const pricing = priceParcel(sample.quote, 1500, "included");
  customers.push({
    id: `c${number}`,
    name: sample.name,
    phone: `0917 XXX ${120 + index}`,
    color: colors[index],
    addresses: [
      {
        id: addressId,
        label: "Home",
        text: `${10 + index} Sample Street, Magugpo North`,
        latitude: 7.451 + index * 0.001,
        longitude: 125.811,
        distanceKm: 2,
        minutes: 8,
        verifiedAt: at,
      },
    ],
  });
  parcels.push({
    id,
    reference: `HTD-${2401 + parcels.length}`,
    customerId: `c${number}`,
    addressId,
    sellerId: "s1",
    batchId: "batch-44",
    description: "Everyday essentials",
    expectedMethod: index % 2 === 0 ? "cash" : "gcash",
    pricing,
    status: "delivered",
    receipt: {
      method: index % 2 === 0 ? "cash" : "gcash",
      amount: pricing.total,
      confirmedAt: at,
    },
    note: "",
    attempts: [
      {
        id: `history-${index}`,
        outcome: "delivered",
        note: "Rider confirmed handover and full payment.",
        at,
      },
    ],
  });
  historicalRemittances.push({
    id: `history-remit-${index}`,
    sellerId: "s1",
    method: "cash",
    amount: pricing.sellerShare,
    reference: "Seller handover confirmed",
    at: `${sample.date}T17:30:00+08:00`,
    allocations: [{ parcelId: id, amount: pricing.sellerShare }],
  });
});

export const initialState: PrototypeState = {
  version: 1,
  customers,
  sellers,
  parcels,
  batches: [
    { id: "batch-44", name: "Week 44", start: "2026-10-26", end: "2026-11-01" },
    { id: "batch-45", name: "Week 45", start: "2026-11-02", end: "2026-11-08" },
    { id: "batch-43", name: "Week 43", start: "2026-10-19", end: "2026-10-25" },
  ],
  remittances: [
    {
      id: "remit-demo-1",
      sellerId: "s1",
      method: "cash",
      amount: 6000,
      at: "2026-11-01T09:00:00+08:00",
      reference: "Partial handover confirmed",
      allocations: [{ parcelId: "p4", amount: 6000 }],
    },
    ...historicalRemittances.reverse(),
  ],
  activity: [
    {
      id: "seed-remit",
      title: "₱60 remittance recorded",
      detail: "Aling Nena's Shop · partial handover",
      at: "2026-11-01T09:00:00+08:00",
      type: "money",
      href: "/collections",
    },
    {
      id: "seed-delivery",
      title: "Delivery completed for Bea",
      detail: "₱165 cash received · ₱15 rider fee retained",
      at: "2026-11-01T08:26:00+08:00",
      type: "delivery",
      href: "/deliveries/p9",
    },
    {
      id: "seed-hold",
      title: "Carlo's delivery is on hold",
      detail: "Retry scheduled for tomorrow, 4 PM",
      at: "2026-11-01T08:20:00+08:00",
      type: "notice",
      href: "/deliveries/p6",
    },
  ],
  selectedBatchId: "batch-44",
  manualNextStop: null,
  offline: false,
  pendingChanges: 0,
  notificationsRead: false,
  settings: {
    riderName: "Miguel Dela Cruz",
    phone: "0917 XXX 0123",
    deliveryAlerts: true,
    collectionAlerts: true,
    compactView: false,
  },
};
