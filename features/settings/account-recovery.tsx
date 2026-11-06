"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { RefreshCw } from "lucide-react";
import { useActions } from "@/components/providers";
import {
  Badge,
  Button,
  Card,
  CheckField,
  EmptyState,
  LinkButton,
  PageHeading,
} from "@/components/ui";
import {
  Pagination,
  PaginationEntries,
  usePagination,
} from "@/components/pagination";
import {
  apiIdentity,
  ApiError,
  errorMessage,
  validationMessage,
  type ApiSellerBalance,
  type CollectionPage,
} from "@/lib/api";
import { formatDate, money } from "@/lib/prototype/domain";
import {
  blankParcelDraft,
  canDiscardRecovery,
  discardRecovery,
  listRecovery,
  mutateRecovery,
  newRecoveryEntry,
  performRecovery,
  probeRecovery,
  recoveryLocked,
  recoveryScope,
  RecoveryFailure,
  type ParcelDraft,
  type RecoveryAction,
  type RecoveryEntry,
  type RecoveryKind,
  type RecoveryOperation,
} from "@/lib/recovery";
import { useNotifications } from "./account-notifications";

interface RecoveryActions {
  scope: string | null;
  entries: RecoveryEntry[] | null;
  error: string;
  confirmedRevision: number;
  refresh: () => void;
  invalidateRecords: () => void;
  create: (kind: RecoveryKind) => RecoveryEntry;
  openDraft: (batchId?: string, draftId?: string) => Promise<RecoveryEntry>;
  saveDraft: (
    entry: RecoveryEntry,
    draft: ParcelDraft,
  ) => Promise<RecoveryEntry>;
  send: (
    entry: RecoveryEntry,
    operation: RecoveryOperation | null,
  ) => ReturnType<typeof performRecovery>;
  check: (entry: RecoveryEntry) => ReturnType<typeof probeRecovery>;
  discard: (entry: RecoveryEntry) => Promise<void>;
}
const RecoveryContext = createContext<RecoveryActions | null>(null);

/** Mount a separate recovery lifecycle only after /auth/me has verified this rider. */
export function RecoveryProvider({ children }: { children: ReactNode }) {
  const { session } = useActions();
  const scope = session ? recoveryScope(apiIdentity(), session.user.id) : null;
  return (
    <RecoveryState key={scope ?? "demo"} scope={scope}>
      {children}
    </RecoveryState>
  );
}

/** Share durable preparation and local status; reconnect/focus never sends business mutations. */
function RecoveryState({
  scope,
  children,
}: {
  scope: string | null;
  children: ReactNode;
}) {
  const { request, notify } = useActions();
  const { refresh: refreshNotifications } = useNotifications();
  const [entries, setEntries] = useState<RecoveryEntry[] | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [confirmedRevision, setConfirmedRevision] = useState(0);
  const mounted = useRef(true);
  const generation = useRef(0);
  const channel = useRef<BroadcastChannel | null>(null);
  const openingDrafts = useRef(new Map<string, Promise<RecoveryEntry>>());

  /** Old account handlers cannot send HTTP or publish into the replacement account. */
  const requireScope = useCallback((): string => {
    if (!mounted.current || !scope)
      throw new Error(
        "Sign back in to the same verified rider to recover this work.",
      );
    return scope;
  }, [scope]);
  /** Trigger a fresh local read without polling or replaying queued requests. */
  const refresh = useCallback(() => {
    if (mounted.current) {
      generation.current++;
      setRevision(
        /** Invalidate an older local read. */ (current) => current + 1,
      );
    }
  }, []);
  /** Refresh other tabs using only the scope, never private payloads or credentials. */
  const changed = useCallback(() => {
    refresh();
    channel.current?.postMessage(scope);
  }, [refresh, scope]);
  /** Recovery-panel confirmations refresh pages; inline forms finish their own onSaved flow first. */
  const invalidateRecords = useCallback(() => {
    if (mounted.current)
      setConfirmedRevision(
        /** Invalidate server read models after a recovered save. */ (
          current,
        ) => current + 1,
      );
  }, []);
  /** Refresh alert counts after server proof; inline forms own their remaining read/close lifecycle. */
  const confirmed = useCallback(
    (warning?: string) => {
      if (!mounted.current) return;
      refreshNotifications();
      if (warning) notify(warning, true);
    },
    [notify, refreshNotifications],
  );
  /** Keep local storage scoped even if authentication changes while a transaction finishes. */
  const persist = useCallback(
    async (
      entry: RecoveryEntry,
      action: RecoveryAction,
    ): Promise<RecoveryEntry> => {
      const currentScope = requireScope();
      if (entry.scope !== currentScope)
        throw new Error("This recovery belongs to another account or API.");
      const result = await mutateRecovery(
        currentScope,
        entry.id,
        entry.kind,
        action,
      );
      if (mounted.current) changed();
      return result;
    },
    [requireScope, changed],
  );
  /** Wrap the authenticated transport with a pre-send account-lifecycle guard. */
  const guardedRequest = useCallback(
    async (path: string, method?: string, body?: unknown): Promise<unknown> => {
      requireScope();
      return request(path, method, body);
    },
    [requireScope, request],
  );
  /** Reuse the native durable workflow for parcel, delivery and remittance forms. */
  const send = useCallback(
    async (entry: RecoveryEntry, operation: RecoveryOperation | null) => {
      requireScope();
      const result = await performRecovery(
        operation,
        /** Reject stale editable forms before freezing their operation. */ (
          action,
        ) =>
          persist(
            entry,
            action.type === "prepare" && operation && !recoveryLocked(entry)
              ? { ...action, expectedRevision: entry.revision }
              : action,
          ),
        guardedRequest,
      );
      confirmed(result.warning);
      return result;
    },
    [requireScope, persist, guardedRequest, confirmed],
  );
  /** Check immutable owned evidence; missing evidence does not unlock an uncertain save. */
  const check = useCallback(
    async (entry: RecoveryEntry) => {
      requireScope();
      try {
        const result = await probeRecovery(
          entry,
          guardedRequest,
          /** Persist only observed evidence. */ (action) =>
            persist(entry, action),
        );
        if (result.state === "confirmed") confirmed(result.warning);
        return result;
      } catch (cause) {
        if (cause instanceof ApiError && cause.status === 409)
          await persist(entry, {
            type: "failure",
            attempt: entry.attempts,
            message: validationMessage(cause),
            ambiguous: true,
            review: true,
          });
        throw cause;
      }
    },
    [requireScope, guardedRequest, persist, confirmed],
  );
  /** Draft editing is revision checked, so stale tabs never overwrite newer input. */
  const saveDraft = useCallback(
    async (entry: RecoveryEntry, draft: ParcelDraft) => {
      return persist(entry, {
        type: "draft",
        draft,
        expectedRevision: entry.revision,
      });
    },
    [persist],
  );
  /** Create IDs only in response to an actual form action, never during rendering. */
  const create = useCallback(
    (kind: RecoveryKind) =>
      newRecoveryEntry(requireScope(), crypto.randomUUID(), kind),
    [requireScope],
  );
  /** Resume the latest matching editable draft or persist a fresh one before enabling the form. */
  const openDraft = useCallback(
    async (batchId?: string, draftId?: string) => {
      const key = `${batchId ?? ""}:${draftId ?? ""}`;
      const opening = openingDrafts.current.get(key);
      if (opening) return opening;
      /** Repeated React setup/open requests share one durable creation. */
      const load = async () => {
        const currentScope = requireScope();
        const rows = await listRecovery(currentScope);
        requireScope();
        const existing = rows.find(
          /** Explicit recovery links must resolve the exact draft. */ (row) =>
            draftId
              ? row.id === draftId
              : row.kind === "parcel" &&
                !recoveryLocked(row) &&
                (!batchId || row.draft?.batchId === batchId),
        );
        if (draftId && !existing)
          throw new Error("This draft is unavailable for this rider and API.");
        if (existing) {
          if (
            existing.kind !== "parcel" ||
            recoveryLocked(existing) ||
            !existing.draft
          )
            throw new Error(
              "This submission is frozen. Open Drafts & recovery to check its server status.",
            );
          return existing;
        }
        const entry = create("parcel");
        return saveDraft(entry, blankParcelDraft(batchId));
      };
      const promise = load();
      openingDrafts.current.set(key, promise);
      try {
        return await promise;
      } finally {
        openingDrafts.current.delete(key);
      }
    },
    [requireScope, create, saveDraft],
  );
  /** Deletion is safe only after the native transaction rechecks current uncertainty. */
  const discard = useCallback(
    async (entry: RecoveryEntry) => {
      const currentScope = requireScope();
      if (entry.scope !== currentScope)
        throw new Error("Different recovery account.");
      await discardRecovery(currentScope, entry.id, entry.revision);
      if (mounted.current) changed();
    },
    [requireScope, changed],
  );
  /** Cross-tab messages and focus refresh local rows only; neither sends a retry. */
  useEffect(() => {
    mounted.current = true;
    if (scope && typeof BroadcastChannel !== "undefined") {
      try {
        channel.current = new BroadcastChannel("hatid-recovery-v1");
        channel.current.onmessage =
          /** Ignore every other API/rider namespace. */ (event) => {
            if (event.data === scope) refresh();
          };
      } catch {
        channel.current =
          null; /* Focus/manual refresh still works when cross-tab messaging is denied. */
      }
    }
    window.addEventListener("focus", refresh);
    return () => {
      mounted.current = false;
      channel.current?.close();
      channel.current = null;
      window.removeEventListener("focus", refresh);
    };
  }, [scope, refresh]);
  /** Missing/denied storage leaves counts unknown and exposes an explicit retry. */
  useEffect(() => {
    if (!scope) return;
    const ticket = ++generation.current;
    let active = true;
    listRecovery(scope).then(
      /** Publish only the latest read for this mounted account. */ (rows) => {
        if (active && ticket === generation.current) {
          setEntries(rows);
          setError("");
        }
      },
      /** Preserve an honest unknown state on corruption/quota/permission failure. */ (
        cause,
      ) => {
        if (active && ticket === generation.current) {
          setEntries(null);
          setError(errorMessage(cause));
        }
      },
    );
    return () => {
      active = false;
    };
  }, [scope, revision]);
  return (
    <RecoveryContext.Provider
      value={{
        scope,
        entries,
        error,
        confirmedRevision,
        refresh,
        invalidateRecords,
        create,
        openDraft,
        saveDraft,
        send,
        check,
        discard,
      }}
    >
      {children}
    </RecoveryContext.Provider>
  );
}

/** Use the same account preparation rules from every real money/intake form. */
export function useRecovery(): RecoveryActions {
  const context = useContext(RecoveryContext);
  if (!context) throw new Error("Recovery requires the rider workspace.");
  return context;
}

/** Actual browser drafts and server-confirmed recovery replace sample sync in account mode. */
export function AccountRecovery() {
  const { entries, error, refresh } = useRecovery();
  const [status, setStatus] = useState("all");
  const rows = (entries ?? []).filter(
    /** Status filters apply only to already loaded local records. */ (row) =>
      status === "all" || row.status === status,
  );
  const pagination = usePagination(rows, status);
  return (
    <>
      <PageHeading
        title="Drafts & recovery"
        description="Work saved on this browser for your verified rider account. Check server status before retrying an interrupted save."
      >
        <Button variant="secondary" onClick={refresh}>
          <RefreshCw size={16} /> Refresh
        </Button>
      </PageHeading>
      <div className="notice notice-blue">
        <p>
          Parcel drafts autosave here. Interrupted submissions keep their
          original operation and values. No automatic background sending. Final
          remittance checks and fresh routing need a connection.
        </p>
      </div>
      {error && (
        <p role="alert" className="notice notice-amber">
          {error}
        </p>
      )}
      <Card>
        <div className="card-body form-stack">
          <div className="list-toolbar">
            <PaginationEntries {...pagination.controls} />
            <select
              aria-label="Recovery status"
              value={status}
              onChange={
                /** Reset pagination when the status changes. */ (event) =>
                  setStatus(event.target.value)
              }
            >
              <option value="all">All statuses</option>
              <option value="draft">Draft</option>
              <option value="pending">Pending confirmation</option>
              <option value="needs_review">Needs review</option>
              <option value="confirmed">Confirmed</option>
            </select>
          </div>
          {entries === null ? (
            <p role="status">
              {error
                ? "Local recovery could not be loaded. Your existing records were preserved."
                : "Loading this rider’s local work…"}
            </p>
          ) : rows.length ? (
            pagination.items.map(
              /** Keep manual review state attached to the same operation. */ (
                entry,
              ) => <RecoveryRow key={entry.id} entry={entry} />,
            )
          ) : (
            <EmptyState title="No local work in this view">
              New parcel drafts and interrupted saves appear here.
            </EmptyState>
          )}
        </div>
        <Pagination {...pagination.controls} />
      </Card>
      <p className="small-muted">
        Browser storage can be cleared or evicted and is accessible to scripts
        on this origin. It is not an encrypted vault or a server backup. Signing
        out hides these records in Hatid; sign back in as the same rider to
        recover them. Keep this device private.
      </p>
    </>
  );
}

/** Review one frozen operation and require an explicit checked retry, especially for money. */
function RecoveryRow({ entry }: { entry: RecoveryEntry }) {
  const { check, send, discard, invalidateRecords } = useRecovery();
  const { request, notify } = useActions();
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState("");
  const [balance, setBalance] = useState<ApiSellerBalance | null>(null);
  const active = useRef(true);
  /** Ignore a response after this row/account/revision has been replaced. */
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const operation = entry.operation;
  const editable =
    entry.kind === "parcel" && !recoveryLocked(entry) && !!entry.draft;
  const label = {
    draft: "Draft",
    pending: "Pending confirmation",
    needs_review: "Needs review",
    confirmed: "Confirmed",
  }[entry.status];
  const targetHref = entry.target
    ? entry.target.kind === "remittance"
      ? `/collections?remittance=${entry.target.id}`
      : `/deliveries/${entry.target.id}`
    : null;

  /** Fetch current seller-share debt without treating it as a wallet or a second handover. */
  async function currentBalance() {
    if (operation?.kind !== "remittance") return null;
    const { data } = await request<CollectionPage<ApiSellerBalance>>(
      `/collections/sellers?seller_id=${operation.values.seller_id}&per_page=10`,
    );
    const seller = data.find(
      /** Require the exact owned seller. */ (row) =>
        row.id === operation.values.seller_id,
    );
    if (!seller || seller.balance.outstanding < operation.values.amount)
      throw new Error(
        "The current seller share cannot cover this original amount. Keep the evidence and review Collections; do not create another handover.",
      );
    return seller;
  }
  /** A missing server result permits a reviewed exact retry, not editing or deletion. */
  async function inspect() {
    if (busy) return;
    setBusy(true);
    setChecked(false);
    setConfirmed(false);
    setMessage("");
    try {
      const result = await check(entry);
      if (result.state === "confirmed") {
        invalidateRecords();
        return;
      }
      if (!active.current) return;
      const seller = await currentBalance();
      if (active.current) {
        setBalance(seller);
        setChecked(true);
        setMessage(
          "Not recorded yet. An earlier request may still finish. Retry only these original values.",
        );
      }
    } catch (cause) {
      if (active.current) setMessage(validationMessage(cause));
    } finally {
      if (active.current) setBusy(false);
    }
  }
  /** Probe again immediately before a manually approved identical send; never transfer money again. */
  async function retry() {
    if (busy || !checked || !confirmed || !operation) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await check(entry);
      if (result.state === "confirmed") {
        invalidateRecords();
        return;
      }
      if (!active.current) return;
      await currentBalance();
      if (!active.current) return;
      await send(result.entry, null);
      invalidateRecords();
      notify("Original operation confirmed by the server.");
    } catch (cause) {
      if (active.current) {
        setChecked(false);
        setConfirmed(false);
        setMessage(
          validationMessage(
            cause instanceof RecoveryFailure ? cause.cause : cause,
          ),
        );
      }
    } finally {
      if (active.current) setBusy(false);
    }
  }
  /** Ask for deletion only when the record is already safe to discard. */
  async function remove() {
    if (
      !window.confirm(
        entry.status === "confirmed"
          ? "Remove this local confirmation marker? The server record stays saved."
          : "Discard this editable local draft/rejected submission?",
      )
    )
      return;
    setBusy(true);
    try {
      await discard(entry);
    } catch (cause) {
      if (active.current) {
        setMessage(errorMessage(cause));
        setBusy(false);
      }
    }
  }
  return (
    <section className="recovery-entry form-stack">
      <div className="recovery-heading">
        <strong>
          {entry.kind === "parcel"
            ? "Parcel intake"
            : entry.kind === "delivery"
              ? "Delivery outcome"
              : "Seller remittance"}
        </strong>
        <Badge tone={entry.status === "confirmed" ? "green" : "amber"}>
          {label}
        </Badge>
      </div>
      <small className="small-muted">
        Updated {formatDate(entry.updatedAt)}
      </small>
      {operation?.kind === "parcel" && (
        <p>
          Batch #{operation.values.batch_id} · customer #
          {operation.values.customer_id} · seller #{operation.values.seller_id}{" "}
          · quote {money(operation.values.quote)}, fee{" "}
          {money(operation.values.fee)} {operation.values.mode}.
        </p>
      )}
      {operation?.kind === "delivery" && (
        <p>
          {operation.values.outcome} · parcel IDs{" "}
          {operation.values.parcel_ids.join(", ")}. Receipts, notes and original
          outcome values stay fixed.
        </p>
      )}
      {operation?.kind === "remittance" && (
        <p>
          Seller #{operation.values.seller_id} ·{" "}
          {money(operation.values.amount)} ·{" "}
          {operation.values.method === "gcash" ? "external GCash" : "cash"} ·
          reference {operation.values.reference || "none"}.
        </p>
      )}
      {(message || entry.lastError) && (
        <p role="status" className="notice notice-amber">
          {message || entry.lastError}
        </p>
      )}
      {checked && operation && (
        <>
          <p>
            {balance
              ? `Current seller share for ${balance.name}: ${money(balance.balance.outstanding)}.`
              : "Only the original submission will be retried."}
          </p>
          <CheckField checked={confirmed} onChange={setConfirmed}>
            {operation.kind === "remittance"
              ? "The original handover was already completed. Record it only; I will not hand over or transfer the money again."
              : "I reviewed the original action and values and want to retry this exact operation."}
          </CheckField>
        </>
      )}
      <div className="recovery-actions">
        {editable && (
          <LinkButton
            href={`/parcels/new?draft=${encodeURIComponent(entry.id)}`}
            variant="secondary"
          >
            Resume draft
          </LinkButton>
        )}
        {operation && (
          <Button disabled={busy} variant="secondary" onClick={inspect}>
            {busy ? "Checking…" : "Check server status"}
          </Button>
        )}
        {checked && operation && (
          <Button disabled={busy || !confirmed} onClick={retry}>
            Retry original save
          </Button>
        )}
        {targetHref && (
          <LinkButton href={targetHref} variant="secondary">
            Open saved record
          </LinkButton>
        )}
        {canDiscardRecovery(entry) && (
          <Button disabled={busy} variant="ghost" onClick={remove}>
            {entry.status === "confirmed" ? "Remove marker" : "Discard"}
          </Button>
        )}
      </div>
    </section>
  );
}
