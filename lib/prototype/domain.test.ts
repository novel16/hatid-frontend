import assert from "node:assert/strict";
import test from "node:test";
import { initialState } from "./seed.ts";
import {
  addParcel,
  chosenStop,
  deliverParcels,
  eligible,
  parseMoney,
  priceParcel,
  recommendedStops,
  recordOutcome,
  recordRemittance,
  saveAddressPin,
  saveSeller,
  sellerBalance,
  totals,
} from "./domain.ts";

const fresh = () => structuredClone(initialState);
const at = "2026-11-01T11:00:00+08:00";

test("a saved or corrected pin never fabricates a road estimate", () => {
  const state = fresh();
  const updated = saveAddressPin(state, "c1", "a1", 7.46, 125.82);
  const address = updated.customers.find((customer) => customer.id === "c1")!
    .addresses[0];
  assert.equal(address.latitude, 7.46);
  assert.equal(address.distanceKm, 0);
  assert.equal(address.minutes, 0);
  assert.ok(
    !recommendedStops(updated, new Date(at)).some(
      (stop) => stop.customer.id === "c1",
    ),
  );
  assert.equal(
    chosenStop({ ...updated, manualNextStop: "c1:a1" })?.customer.id,
    "c1",
  );
});

for (const example of [
  {
    mode: "included" as const,
    quote: 11500,
    fee: 1500,
    collect: 11500,
    seller: 10000,
  },
  {
    mode: "excluded" as const,
    quote: 10000,
    fee: 1500,
    collect: 11500,
    seller: 10000,
  },
  {
    mode: "excluded" as const,
    quote: 11500,
    fee: 1500,
    collect: 13000,
    seller: 11500,
  },
]) {
  test(`${example.mode}: quote ${example.quote} produces collect ${example.collect}, seller ${example.seller}`, () => {
    const pricing = priceParcel(example.quote, example.fee, example.mode);
    assert.equal(pricing.total, example.collect);
    assert.equal(pricing.sellerShare, example.seller);
    assert.equal(pricing.sellerShare + pricing.fee, pricing.total);
  });
}

test("money inputs preserve cents and reject unsafe or invalid amounts", () => {
  assert.equal(parseMoney("115.10"), 11510);
  for (const value of ["1.001", "-15", "1e5", "NaN", "", "9007199254740992"])
    assert.throws(() => parseMoney(value));
  assert.throws(() => priceParcel(1000, 1500, "included"));
  assert.throws(() => priceParcel(1000.1, 15, "excluded"));
  assert.throws(() => priceParcel(1000, -15, "excluded"));
});

test("partial delivery records only selected parcels and retains each fee once", () => {
  const state = fresh();
  const before = totals(state);
  const next = deliverParcels(
    state,
    ["p1", "p1"],
    { p1: "cash" },
    "delivery-test",
    at,
  );
  assert.equal(
    next.parcels.find((parcel) => parcel.id === "p1")?.status,
    "delivered",
  );
  assert.equal(
    next.parcels.find((parcel) => parcel.id === "p2")?.status,
    "pending",
  );
  assert.equal(totals(next).fees - before.fees, 1500);
  assert.equal(totals(next).cash - before.cash, 11500);
  assert.equal(totals(next).gcash, before.gcash);
  assert.equal(
    deliverParcels(next, ["p1"], { p1: "cash" }, "delivery-test", at),
    next,
  );
  assert.throws(() =>
    deliverParcels(next, ["p1"], { p1: "cash" }, "duplicate-new-id", at),
  );
});

test("manual delivery works with no saved pin and skipping location preserves payment", () => {
  const state = fresh();
  const next = deliverParcels(
    state,
    ["p10"],
    { p10: "gcash" },
    "manual-handover",
    at,
  );
  assert.equal(
    next.customers.find((customer) => customer.id === "c8")?.addresses[0]
      .latitude,
    null,
  );
  assert.equal(
    next.parcels.find((parcel) => parcel.id === "p10")?.receipt?.method,
    "gcash",
  );
  assert.equal(
    next.parcels.find((parcel) => parcel.id === "p10")?.status,
    "delivered",
  );
  assert.equal(totals(next).gcash - totals(state).gcash, 10000);
});

test("saving a new customer pin requires delivery and keeps other addresses distinct", () => {
  const state = fresh();
  const customer = state.customers.find((entry) => entry.id === "c8")!;
  customer.addresses.push({
    ...customer.addresses[0],
    id: "a8-work",
    label: "Work",
  });
  assert.throws(() => saveAddressPin(state, "c8", "a8", 7.45, 125.8));
  const delivered = deliverParcels(
    state,
    ["p10"],
    { p10: "cash" },
    "delivery-for-pin",
    at,
  );
  const next = saveAddressPin(delivered, "c8", "a8", 7.45, 125.8);
  const addresses = next.customers.find(
    (entry) => entry.id === "c8",
  )!.addresses;
  assert.equal(
    addresses.find((address) => address.id === "a8")?.latitude,
    7.45,
  );
  assert.equal(
    addresses.find((address) => address.id === "a8-work")?.latitude,
    null,
  );
  assert.equal(totals(next).fees, totals(delivered).fees);
  assert.throws(() => saveAddressPin(delivered, "c8", "a8", 91, 125.8));
});

test("recommendations compare at most five reachable eligible stops", () => {
  const state = fresh();
  const suggestions = recommendedStops(state, new Date(at));
  assert.equal(suggestions.length, 5);
  assert.ok(suggestions.every((stop) => stop.address.latitude !== null));
  assert.ok(
    !suggestions.some(
      (stop) =>
        stop.customer.id === "c4" ||
        stop.customer.id === "c6" ||
        stop.customer.id === "c8",
    ),
  );
  assert.equal(suggestions[0].customer.id, "c1");
  assert.ok(
    suggestions.every(
      (stop, index) =>
        index === 0 ||
        suggestions[index - 1].address.minutes <= stop.address.minutes,
    ),
  );
  const manual = chosenStop({ ...state, manualNextStop: "c8:a8" });
  assert.equal(manual?.customer.name, "Nora Dela Cruz");
});

test("future holds need an explicit resume and do not accrue earnings", () => {
  const state = fresh();
  const held = state.parcels.find((parcel) => parcel.id === "p6")!;
  assert.equal(eligible(held, new Date(at)), false);
  assert.throws(() =>
    deliverParcels(state, ["p6"], { p6: "cash" }, "premature", at),
  );
  const resumed = recordOutcome(
    state,
    ["p6"],
    "pending",
    "Customer confirmed availability",
  );
  assert.equal(totals(resumed).fees, totals(state).fees);
  assert.equal(
    eligible(
      resumed.parcels.find((parcel) => parcel.id === "p6")!,
      new Date(at),
    ),
    true,
  );
  const delivered = deliverParcels(
    resumed,
    ["p6"],
    { p6: "cash" },
    "resumed",
    at,
  );
  assert.equal(totals(delivered).fees - totals(state).fees, 1500);
});

test("partial remittances allocate only the seller share and do not change retained earnings", () => {
  const sample = fresh();
  const state = {
    ...sample,
    parcels: sample.parcels.filter((parcel) => parcel.id === "p4"),
    remittances: [],
  };
  assert.equal(sellerBalance(state, "s1"), 10000);
  const first = recordRemittance(state, {
    id: "partial-remit",
    sellerId: "s1",
    amount: 6000,
    method: "cash",
    at,
    reference: "First handover",
  });
  assert.equal(sellerBalance(first, "s1"), 4000);
  assert.equal(totals(first).fees, 1500);
  assert.equal(first.remittances[0].allocations[0].amount, 6000);
  assert.equal(recordRemittance(first, first.remittances[0]), first);
  const settled = recordRemittance(first, {
    id: "final-remit",
    sellerId: "s1",
    amount: 4000,
    method: "gcash",
    at,
    reference: "External transfer confirmed",
  });
  assert.equal(sellerBalance(settled, "s1"), 0);
  assert.equal(totals(settled).fees, 1500);
  assert.throws(() =>
    recordRemittance(first, {
      id: "too-much",
      sellerId: "s1",
      amount: 5000,
      method: "cash",
      at,
      reference: "",
    }),
  );
});

test("offline mode preserves manual delivery but blocks fresh recommendations and remittances", () => {
  const state = { ...fresh(), offline: true, manualNextStop: "c8:a8" };
  assert.deepEqual(recommendedStops(state, new Date(at)), []);
  assert.equal(chosenStop(state)?.customer.id, "c8");
  const delivered = deliverParcels(
    state,
    ["p10"],
    { p10: "cash" },
    "offline-delivery",
    at,
  );
  assert.equal(
    delivered.parcels.find((parcel) => parcel.id === "p10")?.status,
    "delivered",
  );
  assert.throws(() =>
    recordRemittance(state, {
      id: "offline-remit",
      sellerId: "s1",
      amount: 1000,
      method: "cash",
      at,
      reference: "",
    }),
  );
});

test("seller default edits affect new parcels without recalculating saved snapshots", () => {
  const state = fresh();
  const original = state.parcels.find((parcel) => parcel.id === "p1")!;
  const next = saveSeller(state, {
    ...state.sellers[0],
    mode: "excluded",
    fee: 2000,
  });
  assert.deepEqual(
    next.parcels.find((parcel) => parcel.id === "p1")?.pricing,
    original.pricing,
  );
  const newParcel = {
    ...original,
    id: "new-priced-parcel",
    pricing: priceParcel(10000, 2000, "excluded"),
  };
  const saved = addParcel(next, newParcel);
  assert.equal(
    saved.parcels.find((parcel) => parcel.id === "new-priced-parcel")?.pricing
      .total,
    12000,
  );
  assert.equal(
    saved.parcels.find((parcel) => parcel.id === "p1")?.pricing.total,
    11500,
  );
  assert.throws(() =>
    addParcel(next, {
      ...newParcel,
      id: "unexplained-override",
      pricing: priceParcel(10000, 1500, "included"),
    }),
  );
});

test("completed parcel money cannot be silently changed by a failed or hold outcome", () => {
  const state = fresh();
  assert.throws(() => recordOutcome(state, ["p4"], "failed", "Attempted edit"));
  assert.throws(() => recordOutcome(state, ["p4"], "held", "Attempted edit"));
  assert.equal(
    state.parcels.find((parcel) => parcel.id === "p4")?.status,
    "delivered",
  );
});
