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
  type ApiUser,
  type AuthSession,
  type NewPassword,
} from "@/lib/api";

interface AppActions {
  notify: (message: string, error?: boolean) => void;
  commit: (
    action: (state: PrototypeState) => PrototypeState,
    message?: string,
  ) => boolean;
  session: AuthSession | null;
  mode: "guest" | "demo" | "authenticated";
  signIn: (session: AuthSession) => Promise<void>;
  signOut: () => Promise<void>;
  enterDemo: () => void;
  changePassword: (
    data: NewPassword & { current_password: string },
  ) => Promise<void>;
}

const ActionsContext = createContext<AppActions | null>(null);

export function Providers({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{
    id: string;
    message: string;
    error: boolean;
  } | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [demo, setDemo] = useState(false);
  const authVersion = useRef(0);

  const notify = useCallback((message: string, error = false) => {
    const id = crypto.randomUUID();
    setToast({ id, message, error });
    setTimeout(
      () => setToast((current) => (current?.id === id ? null : current)),
      4500,
    );
  }, []);

  const endSession = useCallback(
    (message?: string) => {
      authVersion.current += 1;
      setSession(null);
      setDemo(false);
      if (message) notify(message, true);
    },
    [notify],
  );

  const signIn = useCallback(async (candidate: AuthSession) => {
    const attempt = ++authVersion.current;
    const { data: user } = await authApi.me(candidate.access_token);
    if (
      user.role !== "rider" ||
      !(Date.parse(candidate.expires_at) > Date.now())
    ) {
      throw new ApiError(
        "This rider sign-in is no longer valid. Please sign in again.",
        401,
      );
    }
    if (attempt !== authVersion.current) {
      throw new ApiError("This sign-in was cancelled. Please try again.", 0);
    }
    setSession({ ...candidate, user });
    setDemo(false);
  }, []);

  const request = useCallback(
    async <T,>(path: string, method = "GET", data?: unknown): Promise<T> => {
      if (!session) throw new ApiError("Sign in to continue.", 401);
      const attempt = authVersion.current;
      try {
        return await apiRequest<T>(path, method, data, session.access_token);
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
    [session, endSession],
  );

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

  const enterDemo = useCallback(() => {
    if (session) return;
    authVersion.current += 1;
    setDemo(true);
  }, [session]);

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
    function verifyAccount() {
      void request<{ data: ApiUser }>("/auth/me")
        .then(({ data: user }) => {
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
        mode: session ? "authenticated" : demo ? "demo" : "guest",
        signIn,
        signOut,
        enterDemo,
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

export function WorkspaceAccess({ children }: { children: ReactNode }) {
  const { mode } = useActions();
  const path = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const returnTo = path + (params.size ? "?" + params.toString() : "");

  useEffect(() => {
    if (mode === "guest")
      router.replace("/login?next=" + encodeURIComponent(returnTo));
  }, [mode, returnTo, router]);

  if (mode === "guest")
    return (
      <main id="main-content" className="workspace-loading">
        Opening sign in…
      </main>
    );
  return children;
}
