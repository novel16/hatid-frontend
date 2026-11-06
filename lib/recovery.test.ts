import assert from "node:assert/strict";
import test from "node:test";
import { ApiError } from "./api.ts";
import {
  recoveryScope,
  blankParcelDraft,
  newRecoveryEntry,
  transitionRecovery,
  performRecovery,
  probeRecovery,
  parseRecoveryEntry,
  recoveryLocked,
  canDiscardRecovery,
  recoveryPath,
  validateRecoveryOperation,
  RecoveryFailure,
  type RecoveryAction,
  type RecoveryEntry,
} from "./recovery.ts";

const scope = "https://api.hatid.test|rider:7";
const id = "00000000-0000-4000-8000-000000000007";
const operationId = "00000000-0000-4000-8000-000000000015";
const now = "2026-11-06T04:00:00.000Z";
const operation = {
  kind: "parcel" as const,
  values: {
    operation_id: operationId,
    batch_id: 2,
    customer_id: 3,
    address_id: 4,
    seller_id: 5,
    description: "Parcel",
    note: "",
    quote: 11500,
    fee: 1500,
    mode: "included" as const,
    expected_method: "cash" as const,
  },
};

/** Different verified riders or API environments must never share a local namespace. */
test("recovery scopes separate riders and API environments", () => {
  assert.equal(recoveryScope("https://api.hatid.test/", 7), scope);
  assert.notEqual(recoveryScope("https://api.hatid.test", 8), scope);
  assert.notEqual(recoveryScope("https://other.hatid.test", 7), scope);
  assert.throws(() => recoveryScope("https://user:secret@api.hatid.test", 7));
});

/** Preparing a submission freezes the original operation rather than a later edited form. */
test("prepared recovery payloads cannot be changed by a draft edit", () => {
  const entry = newRecoveryEntry(scope, id, "parcel", now);
  const draft = transitionRecovery(
    entry,
    { type: "draft", draft: blankParcelDraft("2"), expectedRevision: 0 },
    now,
  );
  const pending = transitionRecovery(
    draft,
    { type: "prepare", operation },
    now,
  );
  assert.equal(pending.status, "pending");
  assert.equal(pending.operation?.values.operation_id, operationId);
  assert.throws(
    () =>
      transitionRecovery(
        pending,
        {
          type: "draft",
          draft: blankParcelDraft(),
          expectedRevision: pending.revision,
        },
        now,
      ),
    /pending|frozen|uncertain/i,
  );
  assert.throws(
    () =>
      transitionRecovery(
        pending,
        {
          type: "prepare",
          operation: {
            ...operation,
            values: { ...operation.values, quote: 12000 },
          },
        },
        now,
      ),
    /original|different|frozen/i,
  );
});

/** A failed local preparation cannot be followed by an HTTP mutation. */
test("recovery persists preparation before any HTTP send", async () => {
  let calls = 0;
  await assert.rejects(
    performRecovery(
      operation,
      async () => {
        throw new Error("Storage full");
      },
      async () => {
        calls++;
        return {};
      },
    ),
    /Storage full/,
  );
  assert.equal(calls, 0);
});

const confirmed = {
  state: "confirmed" as const,
  target: { kind: "parcel" as const, id: 21 },
  confirmed_at: now,
};
const parcelResponse = {
  data: {
    id: 21,
    reference: "HTD-000021",
    customer: { id: 3, name: "Test customer", phone: null },
    address: { id: 4 },
    batch: { id: 2 },
    seller: { id: 5 },
    pricing: {
      quote: 11500,
      fee: 1500,
      mode: "included",
      total: 11500,
      sellerShare: 10000,
    },
    expected_method: "cash",
  },
};

/** Exercise real application transitions/workflow without pretending Node supplies a native browser database. */
function memory(initial?: RecoveryEntry) {
  let entry = initial ?? newRecoveryEntry(scope, id, "parcel", now);
  return {
    get: () => structuredClone(entry),
    persist: async (action: RecoveryAction) => {
      entry = transitionRecovery(entry, action, now);
      return structuredClone(entry);
    },
  };
}

/** Neither stale tabs nor another API/rider may replace an existing draft revision. */
test("recovery rejects stale draft revisions and foreign stored scopes", () => {
  const first = newRecoveryEntry(scope, id, "parcel", now);
  const next = transitionRecovery(
    first,
    {
      type: "draft",
      draft: { ...blankParcelDraft(), note: "Typed note" },
      expectedRevision: 0,
    },
    now,
  );
  assert.throws(
    () =>
      transitionRecovery(
        next,
        { type: "draft", draft: blankParcelDraft(), expectedRevision: 0 },
        now,
      ),
    /changed|revision/i,
  );
  assert.equal(next.draft?.note, "Typed note");
  assert.throws(
    /** A stale prepared form cannot bypass its draft revision. */ () =>
      transitionRecovery(
        next,
        { type: "prepare", operation, expectedRevision: first.revision },
        now,
      ),
    /changed|revision/i,
  );
  assert.throws(
    () => parseRecoveryEntry(next, "https://api.hatid.test|rider:8"),
    /scope|account|recovery/i,
  );
  assert.throws(
    () => parseRecoveryEntry({ ...next, version: 99 }, scope),
    /version|recovery/i,
  );
  assert.equal(parseRecoveryEntry(next, scope).draft?.note, "Typed note");
});

/** Deleting an older view cannot erase work saved by another tab. */
test("a stale tab cannot discard newer draft input", () => {
  const original = newRecoveryEntry(scope, id, "parcel", now);
  const edited = transitionRecovery(
    original,
    {
      type: "draft",
      draft: { ...blankParcelDraft(), note: "Newer work in another tab" },
      expectedRevision: original.revision,
    },
    now,
  );
  assert.equal(canDiscardRecovery(edited, original.revision), false);
  assert.equal(canDiscardRecovery(edited), true);
});

/** Persisted operations contain only known business fields, never auth/session objects or arbitrary URLs. */
test("recovery payload validation excludes auth data and unsafe record paths", () => {
  assert.equal(validateRecoveryOperation(operation).kind, "parcel");
  assert.throws(() =>
    validateRecoveryOperation({
      ...operation,
      values: { ...operation.values, access_token: "must-not-persist" },
    }),
  );
  assert.throws(() =>
    validateRecoveryOperation({
      kind: "delivery",
      anchorId: "../settings",
      values: {},
    }),
  );
  assert.equal(recoveryPath(operation), "/parcels");
  assert.equal(recoveryPath(operation, true), "/parcels/recovery");
  assert.equal(
    recoveryPath(
      {
        kind: "delivery",
        anchorId: 12,
        values: {
          operation_id: operationId,
          parcel_ids: [12],
          outcome: "failed",
          note: "No receiver",
        },
      },
      true,
    ),
    "/deliveries/12/recovery",
  );
});

/** Only an owned hash-matching API probe can turn a completed request into a confirmed local marker. */
test("successful recovery verifies server evidence and redacts raw draft and payload", async () => {
  const store = memory();
  const paths: string[] = [];
  const result = await performRecovery(
    operation,
    store.persist,
    async (path, method, body) => {
      assert.equal(method, "POST");
      assert.deepEqual(body, operation.values);
      assert.equal(store.get().status, "pending");
      assert.equal(store.get().operation?.values.operation_id, operationId);
      paths.push(path);
      return path.endsWith("/recovery") ? { data: confirmed } : parcelResponse;
    },
  );
  assert.deepEqual(paths, ["/parcels", "/parcels/recovery"]);
  assert.equal(result.entry.status, "confirmed");
  assert.deepEqual(result.entry.target, { kind: "parcel", id: 21 });
  assert.equal(result.entry.operation, undefined);
  assert.equal(result.entry.draft, undefined);
  assert.equal(store.get().operationId, operationId);
  assert.equal(canDiscardRecovery(result.entry), true);
});

/** A reload or a later rejected retry cannot erase a possibly committed original operation. */
test("reloaded interrupted operations keep their UUID and payload through later 429 rejection", async () => {
  const store = memory();
  await assert.rejects(
    performRecovery(operation, store.persist, async () => {
      throw new ApiError("Lost response", 0);
    }),
    RecoveryFailure,
  );
  const original = structuredClone(store.get());
  assert.equal(original.uncertain, true);
  const reloaded = memory(original);
  await assert.rejects(
    performRecovery(null, reloaded.persist, async (path, method, body) => {
      assert.equal(path, "/parcels");
      assert.deepEqual(body, operation.values);
      throw new ApiError("Too many attempts", 429);
    }),
    RecoveryFailure,
  );
  assert.equal(reloaded.get().status, "needs_review");
  assert.deepEqual(reloaded.get().operation, operation);
  assert.equal(recoveryLocked(reloaded.get()), true);
  assert.equal(canDiscardRecovery(reloaded.get()), false);
});

/** Not found now is not a tombstone: a delayed original request can still arrive and commit. */
test("not-recorded probes never unlock or discard pending submissions", async () => {
  const store = memory();
  await store.persist({ type: "prepare", operation });
  const result = await probeRecovery(
    store.get(),
    async (path, method, body) => {
      assert.equal(path, "/parcels/recovery");
      assert.deepEqual(body, operation.values);
      return {
        data: { state: "not_recorded", target: null, confirmed_at: null },
      };
    },
    store.persist,
  );
  assert.equal(result.state, "not_recorded");
  assert.equal(store.get().uncertain, true);
  assert.equal(recoveryLocked(store.get()), true);
  assert.equal(canDiscardRecovery(store.get()), false);
});

/** A known first validation failure permits correction; an uncertain attempt never takes that path. */
test("definitive first rejection can return an editable parcel draft", async () => {
  const store = memory();
  await assert.rejects(
    performRecovery(operation, store.persist, async () => {
      throw new ApiError("Review override", 422, {
        override_reason: ["Required"],
      });
    }),
    RecoveryFailure,
  );
  assert.equal(store.get().uncertain, false);
  assert.equal(recoveryLocked(store.get()), false);
  const edited = transitionRecovery(
    store.get(),
    {
      type: "draft",
      draft: { ...blankParcelDraft(), quote: "120" },
      expectedRevision: store.get().revision,
    },
    now,
  );
  assert.equal(edited.status, "draft");
  assert.equal(edited.operation, undefined);
});

/** A successful HTTP status without matching saved evidence is still pending, never recorded money. */
test("malformed or unconfirmed success keeps recovery evidence", async () => {
  const store = memory();
  await assert.rejects(
    performRecovery(operation, store.persist, async (path) =>
      path.endsWith("/recovery")
        ? { data: { state: "not_recorded", target: null, confirmed_at: null } }
        : { data: {} },
    ),
    RecoveryFailure,
  );
  assert.equal(store.get().status, "pending");
  assert.equal(store.get().operation?.values.operation_id, operationId);
});

/** Once the server proved success, a local cleanup failure must not tell the rider to create a new save. */
test("confirmed server writes survive failed local confirmation bookkeeping", async () => {
  const store = memory();
  const result = await performRecovery(
    operation,
    async (action) => {
      if (action.type === "confirm")
        throw new Error("Storage full during cleanup");
      return store.persist(action);
    },
    async (path) =>
      path.endsWith("/recovery") ? { data: confirmed } : parcelResponse,
  );
  assert.equal(result.entry.status, "confirmed");
  assert.ok(result.warning);
  assert.equal(store.get().status, "pending");
  assert.equal(store.get().operation?.values.operation_id, operationId);
});

/** Conflicting evidence remains frozen for explicit review. */
test("operation conflicts require review and keep original frozen evidence", async () => {
  const store = memory();
  await assert.rejects(
    performRecovery(
      operation,
      store.persist,
      /** A server hash conflict never proves the intended payload was saved. */ async () => {
        throw new ApiError("Different original evidence", 409);
      },
    ),
    RecoveryFailure,
  );
  assert.equal(store.get().status, "needs_review");
  assert.equal(recoveryLocked(store.get()), true);
  assert.equal(canDiscardRecovery(store.get()), false);
  assert.deepEqual(store.get().operation, operation);
});

/** An older tab's failure response cannot downgrade a confirmation made by another tab. */
test("confirmed entries are terminal even when earlier attempts finish late", async () => {
  const store = memory();
  await store.persist({ type: "prepare", operation });
  const saved = await store.persist({ type: "confirm", result: confirmed });
  const late = transitionRecovery(
    saved,
    { type: "failure", attempt: 1, message: "Late timeout", ambiguous: true },
    now,
  );
  assert.deepEqual(late, saved);
  assert.throws(
    () =>
      transitionRecovery(
        saved,
        {
          type: "draft",
          draft: blankParcelDraft(),
          expectedRevision: saved.revision,
        },
        now,
      ),
    /confirmed|changed|frozen/i,
  );
});
