"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ArrowRight,
  Check,
  CheckCheck,
  ChevronRight,
  RefreshCw,
  Wallet,
  X,
} from "lucide-react";
import { useActions } from "@/components/providers";
import { Badge, Button, EmptyState, LinkButton } from "@/components/ui";
import { Pagination } from "@/components/pagination";
import {
  errorMessage,
  notificationHref,
  notificationPath,
  nextNotificationView,
  type NotificationFilters,
  type NotificationPage,
  type NotificationView,
} from "@/lib/api";
import { formatDate } from "@/lib/prototype/domain";

interface InboxActions {
  unreadCount: number | null;
  revision: number;
  refresh: () => void;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  openInbox: () => void;
  closeInbox: () => void;
  inboxOpen: boolean;
  inboxContent: ReactNode;
}

const InboxContext = createContext<InboxActions | null>(null);

/** Each verified account gets its own private count/read lifecycle; demo never fetches account alerts. */
export function NotificationsProvider({
  children,
  demoContent,
}: {
  children: ReactNode;
  demoContent: ReactNode;
}) {
  const { session } = useActions();
  return (
    <InboxState
      key={session?.user.id ?? "demo"}
      accountId={session?.user.id ?? null}
      demoContent={demoContent}
    >
      {children}
    </InboxState>
  );
}

/** Share one unread count between the shell, inbox and successful local business actions. */
function InboxState({
  accountId,
  children,
  demoContent,
}: {
  accountId: number | null;
  children: ReactNode;
  demoContent: ReactNode;
}) {
  const { request } = useActions();
  const path = usePathname();
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const [revision, setRevision] = useState(0);
  const generation = useRef(0);
  const mounted = useRef(true);
  const [inboxOpen, setInboxOpen] = useState(false);
  /** Open the private panel beside the notification bell. */
  const openInbox = useCallback(() => {
    if (mounted.current) setInboxOpen(true);
  }, []);
  /** Dismissal does not change delivery work or unread metadata. */
  const closeInbox = useCallback(() => setInboxOpen(false), []);

  /** An old account's mutation cannot update a replacement account's count. */
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /** Invalidate earlier reads immediately, before React schedules the next request. */
  const refresh = useCallback(() => {
    if (!mounted.current) return;
    generation.current++;
    setUnreadCount(null);
    setRevision(
      /** Re-read after an explicit refresh or confirmed local write. */ (
        current,
      ) => current + 1,
    );
  }, []);

  /** Route changes and revisions refresh the small count without polling or downloading the inbox. */
  useEffect(() => {
    if (accountId === null) return;
    const controller = new AbortController();
    const ticket = ++generation.current;
    let active = true;
    request<{ data: { unread_count: number } }>(
      "/notifications/unread-count",
      "GET",
      undefined,
      { signal: controller.signal },
    )
      .then(
        /** Only the latest active account read can publish a valid count. */ ({
          data,
        }) => {
          if (!Number.isSafeInteger(data.unread_count) || data.unread_count < 0)
            throw new Error("Unread status could not be confirmed.");
          if (active && ticket === generation.current)
            setUnreadCount(data.unread_count);
        },
      )
      .catch(
        /** Unknown counts stay unknown; a failed request must not claim there are zero alerts. */ () => {
          if (active && ticket === generation.current) setUnreadCount(null);
        },
      );
    return () => {
      active = false;
      controller.abort();
    };
  }, [accountId, path, request, revision]);

  /** Returning from another tab checks for saved activity from other devices. */
  useEffect(() => {
    if (accountId === null) return;
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [accountId, refresh]);

  /** Read metadata is confirmed by Laravel before invalidating the shared inbox/count. */
  const markRead = useCallback(
    async (id: string) => {
      await request(`/notifications/${encodeURIComponent(id)}/read`, "PATCH");
      refresh();
    },
    [request, refresh],
  );

  /** Bulk read covers all currently owned unread alerts, rather than the loaded page alone. */
  const markAllRead = useCallback(async () => {
    await request("/notifications/read-all", "PATCH");
    refresh();
  }, [request, refresh]);

  return (
    <InboxContext.Provider
      value={{
        unreadCount,
        revision,
        refresh,
        markRead,
        markAllRead,
        openInbox,
        closeInbox,
        inboxOpen,
        inboxContent:
          accountId !== null ? (
            <AccountNotifications onNavigate={closeInbox} />
          ) : (
            demoContent
          ),
      }}
    >
      {children}
    </InboxContext.Provider>
  );
}

/** Reuse this feature's shared count/actions anywhere inside the rider workspace. */
export function useNotifications(): InboxActions {
  const context = useContext(InboxContext);
  if (!context)
    throw new Error("Notifications require the rider workspace provider.");
  return context;
}

/** Anchor one nonmodal panel to its bell, sharing familiar outside-click/Escape dismissal. */
export function NotificationPopover({ children }: { children: ReactNode }) {
  const { inboxOpen, closeInbox, inboxContent } = useNotifications();
  const menu = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);
  /** Outside clicks dismiss without blocking the underlying page's action. */
  useEffect(() => {
    if (!inboxOpen) return;
    panel.current?.querySelector<HTMLElement>("button, a[href]")?.focus();
    /** Ignore clicks inside the trigger/panel, including native pagination. */
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !menu.current?.contains(event.target))
        closeInbox();
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [inboxOpen, closeInbox]);
  return (
    <div
      className="notification-menu"
      ref={menu}
      onKeyDown={
        /** Escape closes this panel and returns keyboard focus to the bell. */ (
          event,
        ) => {
          if (event.key !== "Escape" || !inboxOpen) return;
          event.preventDefault();
          event.stopPropagation();
          closeInbox();
          menu.current?.querySelector<HTMLButtonElement>("button")?.focus();
        }
      }
      onBlur={
        /** Tab remains free to leave this nonmodal panel. */ (event) => {
          if (
            event.relatedTarget instanceof Node &&
            !event.currentTarget.contains(event.relatedTarget)
          )
            closeInbox();
        }
      }
    >
      {children}
      {inboxOpen && (
        <section
          ref={panel}
          id="notification-panel"
          className="notification-popover"
          role="dialog"
          aria-modal="false"
          aria-labelledby="notification-panel-title"
        >
          <header className="notification-popover-heading">
            <h2 id="notification-panel-title">Notifications</h2>
            <button
              type="button"
              className="icon-button"
              aria-label="Close notifications"
              onClick={
                /** Close explicitly while preserving the page and unread state. */ () => {
                  closeInbox();
                  menu.current
                    ?.querySelector<HTMLButtonElement>("button")
                    ?.focus();
                }
              }
            >
              <X size={18} />
            </button>
          </header>
          {inboxContent}
        </section>
      )}
    </div>
  );
}

/** Display actual account activity with native pagination and explicit, persistent read actions. */
export function AccountNotifications({
  onNavigate,
}: {
  onNavigate: () => void;
}) {
  const { request, notify } = useActions();
  const { revision, refresh, markRead, markAllRead } = useNotifications();
  const [view, setView] = useState<NotificationView>({
    page: 1,
    perPage: 5,
    unreadOnly: false,
    attempt: 0,
  });
  const [result, setResult] = useState<
    | { key: string; data: NotificationPage; error: null }
    | { key: string; data: null; error: string }
    | null
  >(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const mounted = useRef(true);
  const { unreadOnly } = view;
  const key = `${view.attempt}:${revision}`;
  const data = result?.key === key ? result.data : null;
  const loadError = result?.key === key ? (result.error ?? "") : "";

  /** Every page/filter attempt gets a new identity even when returning to earlier filters. */
  const changeView = useCallback((changes: Partial<NotificationFilters>) => {
    setView(
      /** Preserve other controls while invalidating old results. */ (
        current,
      ) => nextNotificationView(current, { ...changes, perPage: 5 }),
    );
  }, []);

  /** Keep late read-action responses from changing a different screen or account. */
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /** Cancel obsolete reads and correct an unread page that became empty after marking records. */
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    request<NotificationPage>(notificationPath(view), "GET", undefined, {
      signal: controller.signal,
    })
      .then(
        /** Preserve full server totals; never slice a page in the browser. */ (
          response,
        ) => {
          if (!active) return;
          const last = Math.max(1, response.meta.last_page);
          if (view.page > last) {
            changeView({ page: last });
            return;
          }
          setResult({ key, data: response, error: null });
        },
      )
      .catch(
        /** List errors retain a retry path and never replace account rows with demo activity. */ (
          cause,
        ) => {
          if (active)
            setResult({
              key,
              data: null,
              error: errorMessage(cause, "Unable to load your notifications."),
            });
        },
      );
    return () => {
      active = false;
      controller.abort();
    };
  }, [request, view, key, changeView]);

  /** Explicit read controls show confirmed success or a retryable error without hiding history. */
  async function saveRead(id: string | "all") {
    if (busy) return;
    setBusy(id);
    setActionError("");
    try {
      if (id === "all") await markAllRead();
      else await markRead(id);
      if (mounted.current)
        notify(
          id === "all"
            ? "All current notifications marked as read."
            : "Notification marked as read.",
        );
    } catch (cause) {
      if (mounted.current) {
        setActionError(
          errorMessage(
            cause,
            "Read status could not be confirmed. Refresh to review and try again.",
          ),
        );
        refresh();
      }
    } finally {
      if (mounted.current) setBusy(null);
    }
  }

  /** Opening a record stays usable even if its independent read confirmation fails. */
  function opened(id: string, alreadyRead: boolean) {
    onNavigate();
    if (alreadyRead) return;
    void markRead(id).catch(
      /** Refresh actual state after an interrupted confirmation, without blocking navigation. */ () => {
        refresh();
      },
    );
  }

  const controls = {
    ...view,
    total: data?.meta.total ?? 0,
    onChange: changeView,
    disabled: !!busy,
    label: "Notifications pagination",
  };
  return (
    <div className="notification-panel-content form-stack">
      <div className="notification-panel-actions">
        <Button
          variant="secondary"
          onClick={
            /** Confirm read state across all pages. */ () =>
              void saveRead("all")
          }
          disabled={!!busy || !data || data.unread_count === 0}
        >
          <CheckCheck size={16} />
          {busy === "all" ? "Saving…" : "Mark all as read"}
        </Button>
        <Button variant="secondary" onClick={refresh} disabled={!!busy}>
          <RefreshCw size={15} />
          Refresh
        </Button>
        <LinkButton href="/settings" variant="secondary" onClick={onNavigate}>
          Preferences
          <ArrowRight size={15} />
        </LinkButton>
      </div>
      {actionError && (
        <div className="notice notice-amber" role="alert">
          <p>{actionError}</p>
        </div>
      )}
      <section aria-label="Notification activity">
        <div className="table-toolbar notification-toolbar">
          <div
            className="segmented"
            role="group"
            aria-label="Notification read filter"
          >
            <button
              type="button"
              className={!unreadOnly ? "active" : ""}
              aria-pressed={!unreadOnly}
              disabled={!!busy}
              onClick={
                /** Return to the full private timeline. */ () => {
                  changeView({ unreadOnly: false, page: 1 });
                }
              }
            >
              All activity
            </button>
            <button
              type="button"
              className={unreadOnly ? "active" : ""}
              aria-pressed={unreadOnly}
              disabled={!!busy}
              onClick={
                /** Reset to the first unread result. */ () => {
                  changeView({ unreadOnly: true, page: 1 });
                }
              }
            >
              Unread
            </button>
          </div>
        </div>
        {!data && !loadError && (
          <div className="card-body" role="status">
            Loading your notifications…
          </div>
        )}
        {loadError && (
          <div className="card-body notice notice-amber" role="alert">
            <p>{loadError}</p>
            <Button variant="secondary" onClick={refresh}>
              Try again
            </Button>
          </div>
        )}
        {data && (
          <>
            <div className="notification-inbox-summary">
              <Badge tone={data.unread_count ? "green" : "gray"}>
                {data.unread_count} unread
              </Badge>
            </div>
            {data.data.length === 0 ? (
              <EmptyState
                title={unreadOnly ? "All caught up" : "No notifications yet"}
              >
                {unreadOnly
                  ? "You have no unread alerts. Your saved activity remains in All activity."
                  : "New delivery updates and recorded remittances will appear here when their alerts are enabled."}
              </EmptyState>
            ) : (
              <div className="notification-list">
                {data.data.map(
                  /** Each fixed record link stays separate from its explicit read button. */ (
                    item,
                  ) => (
                    <div
                      key={item.id}
                      className={`notification-account-row ${item.read_at ? "notification-read" : ""}`}
                    >
                      <Link
                        href={notificationHref(item.target)}
                        className="notification-item"
                        onClick={
                          /** Record opening confirms read metadata independently of navigation. */ () =>
                            opened(item.id, !!item.read_at)
                        }
                      >
                        <span
                          className={`notification-icon ${item.category === "collection" ? "notification-money" : ""}`}
                        >
                          {item.category === "collection" ? (
                            <Wallet size={21} />
                          ) : (
                            <CheckCheck size={21} />
                          )}
                        </span>
                        <div>
                          <h3>
                            {item.title}
                            {!item.read_at && <i aria-label="Unread" />}
                          </h3>
                          <p>{item.message}</p>
                          <small>{formatDate(item.created_at, true)}</small>
                        </div>
                        <ChevronRight size={18} />
                      </Link>
                      <div className="notification-read-action">
                        {item.read_at ? (
                          <Badge tone="gray">
                            <Check size={12} />
                            Read
                          </Badge>
                        ) : (
                          <Button
                            variant="ghost"
                            disabled={!!busy}
                            aria-label={`Mark ${item.title} as read`}
                            onClick={
                              /** Save only this owned notification's read state. */ () =>
                                void saveRead(item.id)
                            }
                          >
                            {busy === item.id ? "Saving…" : "Mark as read"}
                          </Button>
                        )}
                      </div>
                    </div>
                  ),
                )}
              </div>
            )}
            <Pagination {...controls} compact />
          </>
        )}
      </section>
    </div>
  );
}

/** Old bookmarks open the bell's panel while keeping the page beneath it usable. */
export function NotificationsBridge() {
  const { openInbox } = useNotifications();
  const router = useRouter();
  useEffect(
    /** Keep existing inbox bookmarks compatible with the anchored panel. */ () => {
      openInbox();
      router.replace("/dashboard");
    },
    [openInbox, router],
  );
  return null;
}
