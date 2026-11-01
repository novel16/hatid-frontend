"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Check, CircleAlert, X } from "lucide-react";
import { prototypeStore } from "@/lib/prototype/store";
import type { PrototypeState } from "@/lib/prototype/types";
import type { AuthSession } from "@/lib/api";

interface AppActions {
  notify: (message: string, error?: boolean) => void;
  commit: (
    action: (state: PrototypeState) => PrototypeState,
    message?: string,
  ) => boolean;
  session: AuthSession | null;
  setSession: (session: AuthSession | null) => void;
}

const ActionsContext = createContext<AppActions | null>(null);

export function Providers({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{
    id: string;
    message: string;
    error: boolean;
  } | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);

  useEffect(() => {
    prototypeStore.hydrate();
  }, []);
  useEffect(() => {
    if (!session) return;
    const timer = setTimeout(
      () => setSession(null),
      Math.max(0, new Date(session.expires_at).getTime() - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [session]);

  const notify = useCallback((message: string, error = false) => {
    const id = crypto.randomUUID();
    setToast({ id, message, error });
    setTimeout(
      () => setToast((current) => (current?.id === id ? null : current)),
      4500,
    );
  }, []);

  const commit = useCallback(
    (
      action: (state: PrototypeState) => PrototypeState,
      message?: string,
    ): boolean => {
      try {
        prototypeStore.update(action);
        if (message) notify(message);
        return true;
      } catch (error) {
        notify(
          error instanceof Error
            ? error.message
            : "Unable to save this change.",
          true,
        );
        return false;
      }
    },
    [notify],
  );

  return (
    <ActionsContext value={{ notify, commit, session, setSession }}>
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
