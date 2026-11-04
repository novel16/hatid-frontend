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
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, CircleAlert, X } from "lucide-react";
import { prototypeStore } from "@/lib/prototype/store";
import type { PrototypeState } from "@/lib/prototype/types";
import {
  ApiError,
  apiRequest,
  authApi,
  errorMessage,
  parseStoredSession,
  verifyRiderSession,
  type ApiUser,
  type ApiRequestOptions,
  type ApiToken,
  type SettingsUpdate,
  type AuthSession,
  type StoredAuthSession,
  type NewPassword,
} from "@/lib/api";

interface AppActions {
  notify: (message: string, error?: boolean) => void;
  commit: (
    action: (state: PrototypeState) => PrototypeState,
    message?: string,
  ) => boolean;
  session: AuthSession | null;
  mode: "checking" | "unavailable" | "guest" | "demo" | "authenticated";
  restoreSession: () => Promise<void>;
  signIn: (session: AuthSession) => Promise<void>;
  signOut: () => Promise<void>;
  enterDemo: () => void;
  request: <T>(
    path: string,
    method?: string,
    data?: unknown,
    options?: ApiRequestOptions,
  ) => Promise<T>;
  saveSettings: (data: SettingsUpdate) => Promise<void>;
  revokeDevice: (device: Pick<ApiToken, "id" | "is_current">) => Promise<void>;
  signOutEverywhere: () => Promise<void>;
  changePassword: (
    data: NewPassword & { current_password: string },
  ) => Promise<void>;
}

const ActionsContext = createContext<AppActions | null>(null);
const SESSION_KEY = "hatid.auth.v1";

/** Persist only tab credentials; clearing first prevents an old account surviving a failed write. */
function saveTabSession(session: StoredAuthSession | null): boolean {
  try {
    sessionStorage.removeItem(SESSION_KEY);
    if (session) {
      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          access_token: session.access_token,
          expires_at: session.expires_at,
        }),
      );
    }
    return true;
  } catch {
    return false;
  }
}

/** Own the verified rider session, refresh restoration and separate demo access. */
export function Providers({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{
    id: string;
    message: string;
    error: boolean;
  } | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [demo, setDemo] = useState(false);
  const [restoreState, setRestoreState] = useState<
    "checking" | "ready" | "unavailable"
  >("checking");
  const authVersion = useRef(0);
  const accountReadVersion = useRef(0);
  const accessToken = session?.access_token;

  const notify = useCallback((message: string, error = false) => {
    const id = crypto.randomUUID();
    setToast({ id, message, error });
    setTimeout(
      () => setToast((current) => (current?.id === id ? null : current)),
      4500,
    );
  }, []);

  /** End account/demo access and cancel any older verification before clearing the tab token. */
  const endSession = useCallback(
    (message?: string) => {
      authVersion.current += 1;
      setSession(null);
      setDemo(false);
      setRestoreState("ready");
      saveTabSession(null);
      if (message) notify(message, true);
    },
    [notify],
  );

  /** Verify issued credentials before storing them or allowing workspace access. */
  const signIn = useCallback(
    async (candidate: AuthSession) => {
      const attempt = ++authVersion.current;
      const verified = await verifyRiderSession(candidate);
      if (attempt !== authVersion.current) {
        throw new ApiError("This sign-in was cancelled. Please try again.", 0);
      }
      if (!saveTabSession(verified)) {
        notify(
          "Browser storage is unavailable. Refreshing will require signing in again.",
          true,
        );
      }
      setSession(verified);
      setDemo(false);
      setRestoreState("ready");
    },
    [notify],
  );

  /** Revalidate tab credentials; connection failures keep them available for an explicit retry. */
  const restoreSession = useCallback(async () => {
    const attempt = ++authVersion.current;
    setRestoreState("checking");
    let candidate: StoredAuthSession | null;
    try {
      candidate = parseStoredSession(sessionStorage.getItem(SESSION_KEY));
    } catch {
      setRestoreState("ready");
      notify(
        "Browser storage is unavailable. Refreshing will require signing in again.",
        true,
      );
      return;
    }
    if (!candidate) {
      endSession();
      return;
    }
    try {
      const verified = await verifyRiderSession(candidate);
      if (attempt !== authVersion.current) return;
      setSession(verified);
      setDemo(false);
      setRestoreState("ready");
    } catch (cause) {
      if (attempt !== authVersion.current) return;
      if (
        cause instanceof ApiError &&
        (cause.status === 401 || cause.status === 403)
      ) {
        endSession("Your session has ended. Please sign in again.");
      } else {
        setRestoreState("unavailable");
      }
    }
  }, [endSession, notify]);

  /** Shares Bearer errors and discards responses from an account that has since signed out. */
  const request = useCallback(
    async <T,>(
      path: string,
      method = "GET",
      data?: unknown,
      options?: ApiRequestOptions,
    ): Promise<T> => {
      if (!accessToken) throw new ApiError("Sign in to continue.", 401);
      const attempt = authVersion.current;
      try {
        const result = await apiRequest<T>(
          path,
          method,
          data,
          accessToken,
          options,
        );
        if (attempt !== authVersion.current) {
          throw new ApiError("Your sign-in changed. Please try again.", 0);
        }
        return result;
      } catch (cause) {
        if (
          attempt === authVersion.current &&
          cause instanceof ApiError &&
          (cause.status === 401 || cause.status === 403)
        ) {
          endSession(
            cause.status === 401
              ? "Your session has ended. Sign in again. Your demo work is saved."
              : "This account no longer has rider access. Please sign in again.",
          );
        }
        throw cause;
      }
    },
    [accessToken, endSession],
  );

  /** Updates only the current verified identity; account details never enter demo/browser storage. */
  const saveSettings = useCallback(
    async (values: SettingsUpdate) => {
      const { data: user } = await request<{ data: ApiUser }>(
        "/settings",
        "PATCH",
        values,
      );
      accountReadVersion.current += 1;
      setSession(
        /** Do not apply an account result to a different sign-in. */
        (current) =>
          current && current.access_token === accessToken
            ? { ...current, user }
            : current,
      );
    },
    [request, accessToken],
  );

  /** Revokes only a server-listed owned token and clears local access when it is this device. */
  const revokeDevice = useCallback(
    async (device: Pick<ApiToken, "id" | "is_current">) => {
      await request<void>(`/auth/tokens/${device.id}`, "DELETE");
      if (device.is_current) endSession();
    },
    [request, endSession],
  );

  /** Keeps failed global sign-outs retryable instead of claiming server revocation succeeded. */
  const signOutEverywhere = useCallback(async () => {
    await request<void>("/auth/logout-all", "POST");
    endSession();
  }, [request, endSession]);

  const signOut = useCallback(async () => {
    const token = session?.access_token;
    endSession();
    const attempt = authVersion.current;
    if (!token) return;
    try {
      await authApi.logout(token);
    } catch (cause) {
      if (
        attempt === authVersion.current &&
        !(cause instanceof ApiError && cause.status === 401)
      ) {
        notify(
          "Signed out on this device. Server revocation could not be confirmed; reconnect to revoke the token.",
          true,
        );
      }
    }
  }, [session, endSession, notify]);

  /** Demo entry discards any unverified saved account without mixing its records with samples. */
  const enterDemo = useCallback(() => {
    if (session) return;
    endSession();
    setDemo(true);
  }, [session, endSession]);

  const changePassword = useCallback(
    async (data: NewPassword & { current_password: string }) => {
      const attempt = authVersion.current;
      await request<void>("/auth/password", "PUT", data);
      if (attempt === authVersion.current) {
        endSession();
        notify("Password updated. Sign in again on your devices.");
      }
    },
    [request, endSession, notify],
  );

  useEffect(() => {
    prototypeStore.hydrate();
  }, []);

  /** Restore after mount; StrictMode/unmount cancels stale verification results. */
  useEffect(() => {
    const timer = setTimeout(
      /** Defer storage access until the browser provider is mounted. */
      () => {
        void restoreSession();
      },
      0,
    );
    /** Prevent a pending request from restoring a session after this provider is gone. */
    return () => {
      clearTimeout(timer);
      authVersion.current += 1;
    };
  }, [restoreSession]);

  useEffect(() => {
    if (!session) return;
    const timer = setTimeout(
      () =>
        endSession(
          "Your session has expired. Sign in again. Your demo work is saved.",
        ),
      Math.max(0, Date.parse(session.expires_at) - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [session, endSession]);

  useEffect(() => {
    if (!session) return;
    /** Prevents a focus read started before a saved profile from replacing the newer account. */
    function verifyAccount() {
      const readVersion = accountReadVersion.current;
      void request<{ data: ApiUser }>("/auth/me")
        .then(({ data: user }) => {
          if (readVersion !== accountReadVersion.current) return;
          setSession((current) =>
            current && current.access_token === session?.access_token
              ? { ...current, user }
              : current,
          );
        })
        .catch(() => {
          // Connection failures preserve the local session; 401/403 are handled by request().
        });
    }
    window.addEventListener("focus", verifyAccount);
    return () => window.removeEventListener("focus", verifyAccount);
  }, [session, request]);

  const commit = useCallback(
    (
      action: (state: PrototypeState) => PrototypeState,
      message?: string,
    ): boolean => {
      try {
        prototypeStore.update(action);
        if (message) notify(message);
        return true;
      } catch (cause) {
        notify(errorMessage(cause, "Unable to save this change."), true);
        return false;
      }
    },
    [notify],
  );

  return (
    <ActionsContext
      value={{
        notify,
        commit,
        session,
        mode:
          restoreState !== "ready"
            ? restoreState
            : session
              ? "authenticated"
              : demo
                ? "demo"
                : "guest",
        restoreSession,
        signIn,
        signOut,
        enterDemo,
        request,
        saveSettings,
        revokeDevice,
        signOutEverywhere,
        changePassword,
      }}
    >
      {children}
      <div className="toast-region" aria-live="polite" aria-atomic="true">
        {toast && (
          <div className={`toast ${toast.error ? "toast-error" : ""}`}>
            {toast.error ? (
              <CircleAlert size={19} />
            ) : (
              <span className="toast-check">
                <Check size={15} />
              </span>
            )}
            <span>{toast.message}</span>
            <button onClick={() => setToast(null)} aria-label="Dismiss message">
              <X size={16} />
            </button>
          </div>
        )}
      </div>
    </ActionsContext>
  );
}

export function useActions(): AppActions {
  const context = useContext(ActionsContext);
  if (!context) throw new Error("Use app actions within Providers.");
  return context;
}

/** Reuse the same verification/retry screen on sign-in pages and protected deep links. */
export function SessionCheck() {
  const { mode, restoreSession, signOut } = useActions();
  return (
    <main id="main-content" className="workspace-loading">
      {mode === "unavailable" ? (
        <div className="form-stack session-check">
          <h1>Check your connection</h1>
          <p role="alert">
            We couldn’t verify your sign-in. Reconnect, then try again.
          </p>
          <button
            type="button"
            className="button button-primary"
            onClick={restoreSession}
          >
            Try again
          </button>
          <button
            type="button"
            className="button button-secondary"
            onClick={
              /** Discard the unverified tab credentials and show the sign-in form. */
              () => {
                void signOut();
              }
            }
          >
            Sign in again
          </button>
        </div>
      ) : (
        <p role="status">Checking your sign-in…</p>
      )}
    </main>
  );
}

/** Wait for verification before redirecting guests or rendering the rider workspace. */
export function WorkspaceAccess({ children }: { children: ReactNode }) {
  const { mode } = useActions();
  const path = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const returnTo = path + (params.size ? "?" + params.toString() : "");

  /** Preserve the requested page while redirecting only a confirmed guest. */
  useEffect(() => {
    if (mode === "guest")
      router.replace("/login?next=" + encodeURIComponent(returnTo));
  }, [mode, returnTo, router]);

  if (mode === "checking" || mode === "unavailable") return <SessionCheck />;
  if (mode === "guest")
    return (
      <main id="main-content" className="workspace-loading">
        Opening sign in…
      </main>
    );
  return children;
}
