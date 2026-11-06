import {
  ApiError,
  errorMessage,
  type NewParcel,
  type NewOutcome,
  type NewRemittance,
} from "./api.ts";

export type RecoveryKind = "parcel" | "delivery" | "remittance";
export type RecoveryOperation =
  | { kind: "parcel"; values: NewParcel }
  | { kind: "delivery"; anchorId: number; values: NewOutcome }
  | { kind: "remittance"; values: NewRemittance };
export interface ParcelDraft {
  batchId: string;
  customerId: string;
  addressId: string;
  sellerId: string;
  quote: string;
  fee: string;
  mode: "included" | "excluded";
  method: "cash" | "gcash";
  override: boolean;
  description: string;
  note: string;
  overrideReason: string;
}
export interface RecoveryTarget {
  kind: RecoveryKind;
  id: number;
}
export interface RecoveryStatus {
  state: "confirmed" | "not_recorded";
  target: RecoveryTarget | null;
  confirmed_at: string | null;
}
export interface RecoveryEntry {
  version: 1;
  key: string;
  scope: string;
  id: string;
  revision: number;
  kind: RecoveryKind;
  status: "draft" | "pending" | "needs_review" | "confirmed";
  draft?: ParcelDraft;
  operation?: RecoveryOperation;
  operationId?: string;
  attempts: number;
  uncertain: boolean;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  target?: RecoveryTarget;
  confirmedAt?: string;
}
export type RecoveryAction =
  | { type: "draft"; draft: ParcelDraft; expectedRevision: number }
  | {
      type: "prepare";
      operation?: RecoveryOperation;
      expectedRevision?: number;
    }
  | {
      type: "failure";
      attempt: number;
      message: string;
      ambiguous: boolean;
      review?: boolean;
    }
  | { type: "observe"; message?: string }
  | { type: "confirm"; result: RecoveryStatus };
type Persist = (action: RecoveryAction) => Promise<RecoveryEntry>;
type Request = (
  path: string,
  method?: string,
  body?: unknown,
) => Promise<unknown>;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const kinds = ["parcel", "delivery", "remittance"];

/** Reject unknown fields so tokens and arbitrary transport options cannot enter recovery. */
function object(value: unknown, allowed: string[]): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some(
      /** Allowlisted fields only. */ (key) => !allowed.includes(key),
    )
  )
    throw new Error("Invalid recovery record fields.");
  return value as Record<string, unknown>;
}
/** Keep IDs and centavos as safe integers. */
function integer(value: unknown, minimum = 0): boolean {
  return Number.isSafeInteger(value) && Number(value) >= minimum;
}
/** Validate timestamps without changing the server's original time. */
function timestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}
/** Namespace by verified identity and API, never cached profile or email. */
export function recoveryScope(apiUrl: string, riderId: number): string {
  const url = new URL(apiUrl);
  if (
    !integer(riderId, 1) ||
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error("Invalid recovery account scope.");
  return `${url.href.replace(/\/+$/, "")}|rider:${riderId}`;
}
/** An empty form retains only editable values and selected record IDs. */
export function blankParcelDraft(batchId = ""): ParcelDraft {
  return {
    batchId,
    customerId: "",
    addressId: "",
    sellerId: "",
    quote: "",
    fee: "",
    mode: "included",
    method: "cash",
    override: false,
    description: "",
    note: "",
    overrideReason: "",
  };
}
/** Validate form fields independently from final server business validation. */
function validateDraft(value: unknown): ParcelDraft {
  const row = object(value, Object.keys(blankParcelDraft()));
  const textFields = [
    "batchId",
    "customerId",
    "addressId",
    "sellerId",
    "quote",
    "fee",
    "description",
    "note",
    "overrideReason",
  ];
  if (
    textFields.some(
      /** Bound input without normalizing the rider's text. */ (key) =>
        typeof row[key] !== "string" || (row[key] as string).length > 10000,
    ) ||
    !["included", "excluded"].includes(String(row.mode)) ||
    !["cash", "gcash"].includes(String(row.method)) ||
    typeof row.override !== "boolean"
  )
    throw new Error("Invalid recovery draft.");
  return structuredClone(value) as ParcelDraft;
}
/** Freeze known business inputs; authentication and URLs never belong in an operation. */
export function validateRecoveryOperation(value: unknown): RecoveryOperation {
  const op = object(value, ["kind", "anchorId", "values"]);
  if (
    !kinds.includes(String(op.kind)) ||
    (op.kind === "delivery"
      ? !integer(op.anchorId, 1)
      : op.anchorId !== undefined)
  )
    throw new Error("Invalid recovery operation.");
  const fields =
    op.kind === "parcel"
      ? [
          "operation_id",
          "batch_id",
          "customer_id",
          "address_id",
          "seller_id",
          "description",
          "note",
          "quote",
          "fee",
          "mode",
          "expected_method",
          "override_reason",
        ]
      : op.kind === "delivery"
        ? [
            "operation_id",
            "parcel_ids",
            "outcome",
            "note",
            "retry_at",
            "receipt_confirmed",
            "handover_confirmed",
            "receipts",
          ]
        : [
            "operation_id",
            "seller_id",
            "amount",
            "method",
            "reference",
            "handover_confirmed",
          ];
  const row = object(op.values, fields);
  if (typeof row.operation_id !== "string" || !UUID.test(row.operation_id))
    throw new Error("Invalid recovery operation UUID.");
  if (op.kind === "parcel") {
    if (
      ["batch_id", "customer_id", "address_id", "seller_id"].some(
        /** Require concrete relationship IDs. */ (key) =>
          !integer(row[key], 1),
      ) ||
      !integer(row.quote) ||
      !integer(row.fee) ||
      !["included", "excluded"].includes(String(row.mode)) ||
      !["cash", "gcash"].includes(String(row.expected_method))
    )
      throw new Error("Invalid parcel recovery values.");
  } else if (op.kind === "delivery") {
    if (
      !Array.isArray(row.parcel_ids) ||
      row.parcel_ids.length === 0 ||
      row.parcel_ids.some(
        /** Keep identities numeric. */ (id) => !integer(id, 1),
      ) ||
      new Set(row.parcel_ids).size !== row.parcel_ids.length ||
      !["delivered", "held", "failed", "returned", "pending"].includes(
        String(row.outcome),
      )
    )
      throw new Error("Invalid delivery recovery values.");
    if (row.receipts !== undefined) {
      if (!Array.isArray(row.receipts))
        throw new Error("Invalid recovery receipts.");
      for (const receipt of row.receipts) {
        const item = object(receipt, [
          "parcel_id",
          "method",
          "amount",
          "reference",
        ]);
        if (
          !integer(item.parcel_id, 1) ||
          !integer(item.amount) ||
          !["cash", "gcash"].includes(String(item.method)) ||
          (item.reference != null && typeof item.reference !== "string")
        )
          throw new Error("Invalid recovery receipt.");
      }
    }
    if (
      ["receipt_confirmed", "handover_confirmed"].some(
        /** Optional confirmations remain booleans. */ (key) =>
          row[key] !== undefined && typeof row[key] !== "boolean",
      )
    )
      throw new Error("Invalid recovery confirmation.");
  } else if (
    !integer(row.seller_id, 1) ||
    !integer(row.amount, 1) ||
    !["cash", "gcash"].includes(String(row.method)) ||
    row.handover_confirmed !== true
  )
    throw new Error("Invalid remittance recovery values.");
  for (const key of [
    "description",
    "note",
    "reference",
    "retry_at",
    "override_reason",
  ]) {
    if (
      row[key] !== undefined &&
      (typeof row[key] !== "string" || (row[key] as string).length > 10000)
    )
      throw new Error("Invalid recovery text.");
  }
  return structuredClone(value) as RecoveryOperation;
}
/** Create one local identity; the operation UUID is fixed separately at preparation. */
export function newRecoveryEntry(
  scope: string,
  id: string,
  kind: RecoveryKind,
  now = new Date().toISOString(),
): RecoveryEntry {
  if (!UUID.test(id) || !kinds.includes(kind) || !scope || !timestamp(now))
    throw new Error("Invalid recovery identity.");
  return {
    version: 1,
    key: `${scope}|${id}`,
    scope,
    id,
    revision: 0,
    kind,
    status: "draft",
    ...(kind === "parcel" ? { draft: blankParcelDraft() } : {}),
    attempts: 0,
    uncertain: false,
    lastError: null,
    createdAt: now,
    updatedAt: now,
  };
}
/** Only a known rejection or editable draft can change; uncertainty keeps the exact payload. */
export function recoveryLocked(entry: RecoveryEntry): boolean {
  return (
    entry.status === "confirmed" ||
    entry.status === "pending" ||
    entry.uncertain
  );
}
/** Uncertain operations remain evidence even if a probe currently finds no record. */
export function canDiscardRecovery(
  entry: RecoveryEntry,
  expectedRevision = entry.revision,
): boolean {
  return (
    entry.revision === expectedRevision &&
    (entry.status === "confirmed" || !recoveryLocked(entry))
  );
}
/** Validate the narrow server proof before marking a local operation confirmed. */
function parseStatus(value: unknown, kind: RecoveryKind): RecoveryStatus {
  const row = object(value, ["state", "target", "confirmed_at"]);
  if (
    row.state === "not_recorded" &&
    row.target === null &&
    row.confirmed_at === null
  )
    return row as unknown as RecoveryStatus;
  const target = object(row.target, ["kind", "id"]);
  if (
    row.state !== "confirmed" ||
    target.kind !== kind ||
    !integer(target.id, 1) ||
    !timestamp(row.confirmed_at)
  )
    throw new ApiError(
      "Saved status could not be verified. Keep the original operation.",
      0,
    );
  return structuredClone(row) as unknown as RecoveryStatus;
}
/** Apply synchronous revision-checked rules inside a native transaction. */
export function transitionRecovery(
  current: RecoveryEntry,
  action: RecoveryAction,
  now = new Date().toISOString(),
): RecoveryEntry {
  if (current.status === "confirmed") {
    if (["failure", "observe", "confirm"].includes(action.type))
      return structuredClone(current);
    throw new Error("This operation is already confirmed.");
  }
  const entry = structuredClone(current);
  if (action.type === "draft") {
    if (action.expectedRevision !== entry.revision)
      throw new Error(
        "This draft changed in another tab. Reopen the latest revision.",
      );
    if (entry.kind !== "parcel" || recoveryLocked(entry))
      throw new Error("This pending operation is frozen.");
    entry.draft = validateDraft(action.draft);
    entry.status = "draft";
    entry.lastError = null;
    entry.attempts = 0;
    delete entry.operation;
    delete entry.operationId;
  } else if (action.type === "prepare") {
    if (
      action.expectedRevision !== undefined &&
      action.expectedRevision !== entry.revision
    )
      throw new Error(
        "This draft changed in another tab. Reopen the latest revision.",
      );
    const op = validateRecoveryOperation(action.operation ?? entry.operation);
    if (op.kind !== entry.kind) throw new Error("Different recovery kind.");
    if (
      recoveryLocked(entry) &&
      JSON.stringify(op) !== JSON.stringify(entry.operation)
    )
      throw new Error("Retry only the original frozen operation.");
    entry.uncertain = recoveryLocked(entry);
    entry.attempts = entry.uncertain ? entry.attempts + 1 : 1;
    entry.operation = op;
    entry.operationId = op.values.operation_id;
    entry.status = "pending";
    entry.lastError = null;
  } else if (action.type === "failure") {
    if (action.attempt !== entry.attempts) return entry;
    entry.uncertain = entry.uncertain || action.ambiguous || entry.attempts > 1;
    entry.status =
      action.review || !action.ambiguous ? "needs_review" : "pending";
    entry.lastError = action.message.slice(0, 500);
  } else if (action.type === "observe") {
    entry.uncertain = entry.uncertain || entry.status === "pending";
    entry.lastError =
      action.message ??
      "Not recorded yet. This does not cancel an earlier request. Check again or retry the exact operation.";
  } else {
    const result = parseStatus(action.result, entry.kind);
    if (result.state !== "confirmed" || !entry.operationId)
      throw new Error("No matching confirmed recovery evidence.");
    entry.status = "confirmed";
    entry.target = result.target!;
    entry.confirmedAt = result.confirmed_at!;
    entry.uncertain = false;
    entry.lastError = null;
    delete entry.draft;
    delete entry.operation;
  }
  entry.revision++;
  entry.updatedAt = now;
  return entry;
}
/** Treat browser data as untrusted; preserve unknown/corrupt records for review. */
export function parseRecoveryEntry(
  value: unknown,
  scope: string,
): RecoveryEntry {
  const row = object(value, [
    "version",
    "key",
    "scope",
    "id",
    "revision",
    "kind",
    "status",
    "draft",
    "operation",
    "operationId",
    "attempts",
    "uncertain",
    "lastError",
    "createdAt",
    "updatedAt",
    "target",
    "confirmedAt",
  ]);
  if (
    row.version !== 1 ||
    row.scope !== scope ||
    typeof row.id !== "string" ||
    !UUID.test(row.id) ||
    row.key !== `${scope}|${row.id}` ||
    !kinds.includes(String(row.kind)) ||
    !["draft", "pending", "needs_review", "confirmed"].includes(
      String(row.status),
    ) ||
    !integer(row.revision) ||
    !integer(row.attempts) ||
    typeof row.uncertain !== "boolean" ||
    (row.lastError !== null && typeof row.lastError !== "string") ||
    !timestamp(row.createdAt) ||
    !timestamp(row.updatedAt)
  )
    throw new Error(
      "Recovery data has an unsupported version or account scope. It was preserved for review.",
    );
  if (row.draft !== undefined) validateDraft(row.draft);
  if (
    row.operation !== undefined &&
    validateRecoveryOperation(row.operation).kind !== row.kind
  )
    throw new Error("Invalid recovery operation kind.");
  if (row.status === "confirmed") {
    parseStatus(
      { state: "confirmed", target: row.target, confirmed_at: row.confirmedAt },
      row.kind as RecoveryKind,
    );
    if (
      row.operation ||
      row.draft ||
      typeof row.operationId !== "string" ||
      !UUID.test(row.operationId)
    )
      throw new Error("Invalid confirmed recovery metadata.");
  } else if (
    row.status !== "draft" &&
    (!row.operation ||
      row.operationId !==
        (row.operation as RecoveryOperation).values.operation_id ||
      !integer(row.attempts, 1))
  )
    throw new Error("Recovery payload is missing. The record was preserved.");
  return structuredClone(value) as RecoveryEntry;
}
/** Use fixed owned API routes, never paths supplied by browser storage. */
export function recoveryPath(
  operation: RecoveryOperation,
  recover = false,
): string {
  const op = validateRecoveryOperation(operation);
  return op.kind === "delivery"
    ? `/deliveries/${op.anchorId}/${recover ? "recovery" : "outcomes"}`
    : `/${op.kind === "parcel" ? "parcels" : "remittances"}${recover ? "/recovery" : ""}`;
}
/** Preserve a durable attempt and its cause for inline validation messages. */
export class RecoveryFailure extends Error {
  readonly entry?: RecoveryEntry;
  readonly sent: boolean;
  /** A local preparation failure never implies an HTTP request was sent. */
  constructor(cause: unknown, entry?: RecoveryEntry, sent = false) {
    super(errorMessage(cause), { cause });
    this.name = "RecoveryFailure";
    this.entry = entry;
    this.sent = sent;
  }
}
/** Observe saved UUID/hash evidence without applying another business mutation. */
export async function probeRecovery(
  entry: RecoveryEntry,
  request: Request,
  persist: Persist,
): Promise<{
  entry: RecoveryEntry;
  state: RecoveryStatus["state"];
  warning?: string;
}> {
  if (entry.status === "confirmed") return { entry, state: "confirmed" };
  const op = validateRecoveryOperation(entry.operation);
  const response = (await request(
    recoveryPath(op, true),
    "POST",
    op.values,
  )) as { data?: unknown };
  const result = parseStatus(response?.data, op.kind);
  if (result.state === "not_recorded")
    return { entry: await persist({ type: "observe" }), state: "not_recorded" };
  try {
    return {
      entry: await persist({ type: "confirm", result }),
      state: "confirmed",
    };
  } catch {
    return {
      entry: transitionRecovery(entry, { type: "confirm", result }),
      state: "confirmed",
      warning:
        "Server confirmed the save. Local cleanup failed; Check status again later to update this device.",
    };
  }
}
/** Persist before HTTP and require canonical server evidence before releasing an operation UUID. */
export async function performRecovery(
  operation: RecoveryOperation | null,
  persist: Persist,
  request: Request,
): Promise<{
  entry: RecoveryEntry;
  response: unknown | null;
  warning?: string;
}> {
  let entry: RecoveryEntry;
  try {
    entry = await persist({
      type: "prepare",
      ...(operation ? { operation } : {}),
    });
  } catch (cause) {
    throw new RecoveryFailure(cause);
  }
  const op = entry.operation!;
  let returned = false;
  try {
    const response = await request(recoveryPath(op), "POST", op.values);
    returned = true;
    const result = await probeRecovery(entry, request, persist);
    if (result.state !== "confirmed")
      throw new ApiError(
        "Save is pending confirmation. Check status before another submission.",
        0,
      );
    return { ...result, response };
  } catch (cause) {
    const conflict =
      cause instanceof ApiError &&
      (cause.status === 409 || Boolean(cause.errors.operation_id));
    const ambiguous =
      returned ||
      !(cause instanceof ApiError) ||
      cause.status === 0 ||
      cause.status >= 500 ||
      cause.status === 408 ||
      conflict;
    try {
      entry = await persist({
        type: "failure",
        attempt: entry.attempts,
        message: errorMessage(cause),
        ambiguous,
        review: conflict,
      });
    } catch {
      /* The prior committed pending record still preserves the operation. */
    }
    throw new RecoveryFailure(cause, entry, true);
  }
}

let database: Promise<IDBDatabase> | undefined;
const storeName = "entries";
/** Open lazily: server rendering and pure Node tests never touch browser globals. */
function openDatabase(): Promise<IDBDatabase> {
  if (database) return database;
  database = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(
        new Error(
          "Browser draft storage is unavailable. Enable site storage before saving.",
        ),
      );
      return;
    }
    let settled = false;
    const request = indexedDB.open("hatid-recovery-v1", 1);
    request.onupgradeneeded =
      /** One indexed store keeps account reads small without a library. */ () => {
        const store = request.result.createObjectStore(storeName, {
          keyPath: "key",
        });
        store.createIndex("scope", "scope");
      };
    request.onblocked =
      /** Never silently send an unprotected submission. */ () => {
        settled = true;
        reject(new Error("Close older Hatid tabs to enable draft storage."));
      };
    request.onerror =
      /** Surface denied/quota/private-storage failures before HTTP. */ () => {
        settled = true;
        reject(request.error ?? new Error("Browser draft storage failed."));
      };
    request.onsuccess =
      /** Release cached handles if another tab upgrades storage. */ () => {
        if (settled) {
          request.result.close();
          return;
        }
        const db = request.result;
        db.onversionchange =
          /** Reopen instead of using a stale connection. */ () => {
            db.close();
            database = undefined;
          };
        resolve(db);
      };
  });
  database.catch(
    /** A denied open can be explicitly retried later. */ () => {
      database = undefined;
    },
  );
  return database;
}
/** Read only this verified account/API and acknowledge the completed transaction. */
export async function listRecovery(scope: string): Promise<RecoveryEntry[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const request = transaction
      .objectStore(storeName)
      .index("scope")
      .getAll(scope);
    let rows: RecoveryEntry[] = [];
    let failure: unknown;
    request.onsuccess = /** Validate before publishing browser data. */ () => {
      try {
        rows = request.result.map(
          /** Check isolation on every row. */ (value) =>
            parseRecoveryEntry(value, scope),
        );
      } catch (cause) {
        failure = cause;
      }
    };
    transaction.oncomplete =
      /** Request success alone is not the persistence boundary. */ () => {
        if (failure) reject(failure);
        else
          resolve(
            rows.sort(
              /** Newest work first. */ (a, b) =>
                b.updatedAt.localeCompare(a.updatedAt),
            ),
          );
      };
    transaction.onabort =
      /** Do not publish partial reads from an aborted transaction. */ () =>
        reject(transaction.error ?? new Error("Recovery read failed."));
  });
}
/** Revision checks and writes are atomic across tabs; resolve only after commit. */
export async function mutateRecovery(
  scope: string,
  id: string,
  kind: RecoveryKind,
  action: RecoveryAction,
): Promise<RecoveryEntry> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.get(`${scope}|${id}`);
    let result: RecoveryEntry;
    let failure: unknown;
    request.onsuccess =
      /** Avoid awaits inside a live native transaction. */ () => {
        try {
          const current = request.result
            ? parseRecoveryEntry(request.result, scope)
            : newRecoveryEntry(scope, id, kind);
          if (current.kind !== kind) throw new Error("Recovery kind changed.");
          result = transitionRecovery(current, action);
          store.put(result);
          if (result.status === "confirmed") {
            const scan = store.index("scope").getAll(scope);
            scan.onsuccess =
              /** Prune valid old confirmations; unresolved/corrupt evidence survives. */ () => {
                const confirmed: RecoveryEntry[] = [];
                for (const row of scan.result) {
                  try {
                    const item = parseRecoveryEntry(row, scope);
                    if (item.status === "confirmed") confirmed.push(item);
                  } catch {
                    /* Preserve unknown versions. */
                  }
                }
                confirmed
                  .sort(
                    /** Keep the latest confirmed metadata. */ (a, b) =>
                      b.updatedAt.localeCompare(a.updatedAt),
                  )
                  .slice(50)
                  .forEach(
                    /** Confirmed markers alone are dispensable. */ (item) =>
                      store.delete(item.key),
                  );
              };
          }
        } catch (cause) {
          failure = cause;
          transaction.abort();
        }
      };
    transaction.oncomplete =
      /** Committed preparation alone permits sending HTTP. */ () =>
        resolve(result);
    transaction.onabort =
      /** Quota failures preserve the prior record and block sending. */ () =>
        reject(
          failure ??
            transaction.error ??
            new Error("Draft storage failed. Nothing new was sent."),
        );
  });
}
/** Delete editable drafts/rejections or confirmed markers, never uncertain operations. */
export async function discardRecovery(
  scope: string,
  id: string,
  expectedRevision: number,
): Promise<void> {
  if (!integer(expectedRevision))
    throw new Error("Reopen the current recovery record before discarding it.");
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.get(`${scope}|${id}`);
    let failure: unknown;
    request.onsuccess =
      /** Enforce discard rules in the transaction that deletes. */ () => {
        try {
          if (
            request.result &&
            !canDiscardRecovery(
              parseRecoveryEntry(request.result, scope),
              expectedRevision,
            )
          )
            throw new Error(
              "This record changed in another tab or is uncertain. Refresh and review it before discarding.",
            );
          store.delete(`${scope}|${id}`);
        } catch (cause) {
          failure = cause;
          transaction.abort();
        }
      };
    transaction.oncomplete =
      /** Remove a visible entry only after deletion commits. */ () =>
        resolve();
    transaction.onabort =
      /** Keep the entry when storage rejects deletion. */ () =>
        reject(
          failure ??
            transaction.error ??
            new Error("Unable to discard this draft."),
        );
  });
}
