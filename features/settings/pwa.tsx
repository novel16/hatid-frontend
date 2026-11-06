"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { Download, RefreshCw, Smartphone, WifiOff, X } from "lucide-react";
import { Badge, Button, Card, Modal } from "@/components/ui";
import { mayReloadForUpdate, needsPwaRegistration } from "@/lib/pwa";

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
interface PwaActions {
  online: boolean | null;
  installed: boolean;
  supported: boolean | null;
  updateReady: boolean;
  checking: boolean;
  workerStatus: string;
  openInstall: () => void;
  reviewUpdate: () => void;
  checkUpdates: () => Promise<void>;
}
const PwaContext = createContext<PwaActions | null>(null);
const supportMessages = {
  checking: "Checking app support…",
  insecure: "Install and offline support need a secure HTTPS site.",
  development:
    "Offline fallback and updates are enabled in the deployed production build.",
  unsupported:
    "Offline fallback is unavailable in this browser. You can still use Hatid online.",
  enabled: "Preparing app support…",
};

/** Platform support is fixed for this document; no polling or synthetic state update is needed. */
function subscribeSupport(): () => void {
  return /** There is no mutable capability source to detach. */ () => {};
}
/** The server cannot know the device's installation/security capabilities. */
function serverSupport() {
  return "checking" as const;
}
/** Read native browser support only after React hydrates the client snapshot. */
function browserSupport() {
  if (!window.isSecureContext) return "insecure";
  if (!("serviceWorker" in navigator)) return "unsupported";
  return process.env.NODE_ENV === "production" ? "enabled" : "development";
}

/** Only closed business dialogs can hand control to an explicit update reload. */
function businessDialogOpen(): boolean {
  return (
    document.querySelector("dialog[open]:not(.pwa-update-dialog)") !== null
  );
}

/** Keep native installation/update/connectivity separate from auth and business mutation/recovery. */
export function PwaProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState<boolean | null>(null);
  const [installed, setInstalled] = useState(false);
  const capabilities = useSyncExternalStore(
    subscribeSupport,
    browserSupport,
    serverSupport,
  );
  const supported =
    capabilities === "checking" ? null : capabilities === "enabled";
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [installOpen, setInstallOpen] = useState(false);
  const [installBusy, setInstallBusy] = useState(false);
  const [installMessage, setInstallMessage] = useState("");
  const [workerMessage, setWorkerStatus] = useState("");
  const workerStatus = workerMessage || supportMessages[capabilities];
  const [workerAttempt, setWorkerAttempt] = useState(0);
  const [checking, setChecking] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);
  const [updateSnoozed, setUpdateSnoozed] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [updateError, setUpdateError] = useState("");
  const [reconnected, setReconnected] = useState(false);
  const registration = useRef<ServiceWorkerRegistration | null>(null);
  const offeredWorker = useRef<ServiceWorker | null>(null);
  const reloadRequested = useRef(false);
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);

  /** A new waiting/controller worker may offer an update; repeated focus checks do not undo Later. */
  const offerUpdate = useCallback((worker: ServiceWorker | null) => {
    if (!alive.current || !worker) return;
    if (offeredWorker.current !== worker) setUpdateSnoozed(false);
    offeredWorker.current = worker;
    setUpdateReady(true);
  }, []);

  /** Native network reports are advisory; no API writes/auth restoration are started here. */
  useEffect(() => {
    alive.current = true;
    let wasOffline = !navigator.onLine;
    const display = window.matchMedia("(display-mode: standalone)");
    /** Browser standalone mode and the iOS flag confirm the actual running context. */
    function installedState() {
      setInstalled(
        display.matches ||
          (navigator as Navigator & { standalone?: boolean }).standalone ===
            true,
      );
    }
    /** Online means the device detected a network, not that Laravel or a payment was verified. */
    function network() {
      const current = navigator.onLine;
      setOnline(current);
      if (current && wasOffline) setReconnected(true);
      wasOffline = !current;
    }
    /** Save this one-use native invitation; never install or trigger it automatically. */
    function invitation(event: Event) {
      event.preventDefault();
      setInstallEvent(event as InstallEvent);
    }
    /** An accepted prompt alone is insufficient to claim installation completed. */
    function completedInstall() {
      setInstalled(true);
      setInstallEvent(null);
      setInstallMessage("Hatid was installed on this device.");
    }
    network();
    installedState();
    window.addEventListener("online", network);
    window.addEventListener("offline", network);
    window.addEventListener("beforeinstallprompt", invitation);
    window.addEventListener("appinstalled", completedInstall);
    display.addEventListener("change", installedState);
    return () => {
      alive.current = false;
      window.removeEventListener("online", network);
      window.removeEventListener("offline", network);
      window.removeEventListener("beforeinstallprompt", invitation);
      window.removeEventListener("appinstalled", completedInstall);
      display.removeEventListener("change", installedState);
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
    };
  }, []);

  /** Register only in secure production; the user's dev server never acquires this app's worker. */
  useEffect(() => {
    const enabled =
      process.env.NODE_ENV === "production" &&
      window.isSecureContext &&
      "serviceWorker" in navigator;
    if (!enabled) {
      return;
    }
    let active = true;
    let hadController = navigator.serviceWorker.controller !== null;
    let watched: ServiceWorker | null = null;
    let currentRegistration: ServiceWorkerRegistration | null = null;
    /** First activation/another tab's update cannot reload this page without its own local choice. */
    function controllerChanged() {
      if (!active) return;
      if (reloadRequested.current) {
        if (reloadTimer.current) clearTimeout(reloadTimer.current);
        if (mayReloadForUpdate(true, businessDialogOpen())) {
          reloadRequested.current = false;
          window.location.reload();
          return;
        }
        reloadRequested.current = false;
        setApplying(false);
        setUpdateError("Finish and close your open forms before reloading.");
      }
      if (hadController) offerUpdate(navigator.serviceWorker.controller);
      hadController = true;
    }
    /** Track only the current installing worker, releasing older event handlers. */
    function stateChanged() {
      if (!active || !watched) return;
      if (watched.state === "activated")
        setWorkerStatus(
          "Public offline fallback is enabled. Account records still need a connection.",
        );
      if (watched.state === "redundant" && !currentRegistration?.active)
        setWorkerStatus(
          "Offline support could not finish installing. Keep using Hatid online and check again later.",
        );
      if (watched.state === "installed" && navigator.serviceWorker.controller)
        offerUpdate(currentRegistration?.waiting ?? watched);
    }
    /** A failed new worker leaves the existing app/fallback intact. */
    function updateFound() {
      watched?.removeEventListener("statechange", stateChanged);
      watched = currentRegistration?.installing ?? null;
      watched?.addEventListener("statechange", stateChanged);
      stateChanged();
    }
    /** Check only public worker bytes on focus/reconnect, never queued business requests. */
    function refreshWorker() {
      void currentRegistration
        ?.update()
        .then(
          /** Recognize a worker that was already waiting before this view opened. */ () => {
            if (active && currentRegistration?.waiting)
              offerUpdate(currentRegistration.waiting);
          },
        )
        .catch(
          /** Connection failure stays retryable from the explicit Settings action. */ () => {},
        );
    }
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      controllerChanged,
    );
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then(
        /** Bind only this mounted lifecycle's worker. */ (value) => {
          if (!active) return;
          currentRegistration = value;
          registration.current = value;
          setWorkerStatus(
            needsPwaRegistration(value)
              ? "Offline support could not finish installing. Keep using Hatid online and check again later."
              : value.active
                ? "Public offline fallback is enabled. Account records still need a connection."
                : "Preparing public offline fallback…",
          );
          value.addEventListener("updatefound", updateFound);
          updateFound();
          if (value.waiting && navigator.serviceWorker.controller)
            offerUpdate(value.waiting);
        },
      )
      .catch(
        /** Browser policy/storage failure must not prevent normal sign-in or online delivery. */ () => {
          if (active)
            setWorkerStatus(
              "Offline app support could not be enabled. You can keep using Hatid online and try again later.",
            );
        },
      );
    window.addEventListener("focus", refreshWorker);
    window.addEventListener("online", refreshWorker);
    return () => {
      active = false;
      registration.current = null;
      watched?.removeEventListener("statechange", stateChanged);
      currentRegistration?.removeEventListener("updatefound", updateFound);
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        controllerChanged,
      );
      window.removeEventListener("focus", refreshWorker);
      window.removeEventListener("online", refreshWorker);
    };
  }, [offerUpdate, workerAttempt]);

  /** Re-register an empty/failed first installation without removing a healthy older worker. */
  const retryRegistration = useCallback(() => {
    registration.current = null;
    setWorkerStatus("Trying to enable offline app support again…");
    setWorkerAttempt(
      /** One explicit retry starts a new native registration attempt. */ (
        current,
      ) => current + 1,
    );
  }, []);

  /** A manual check fetches only public worker bytes and does not reload the page. */
  const checkUpdates = useCallback(async () => {
    if (checking) return;
    const value = registration.current;
    if (!value || needsPwaRegistration(value)) {
      retryRegistration();
      return;
    }
    setChecking(true);
    try {
      await value.update();
      if (alive.current) {
        if (value.waiting) offerUpdate(value.waiting);
        setWorkerStatus(
          value.waiting
            ? "An update is ready when you are."
            : "Update check completed. Any available update will be offered here.",
        );
      }
    } catch (cause) {
      if (
        alive.current &&
        cause instanceof DOMException &&
        cause.name === "InvalidStateError"
      )
        retryRegistration();
      else if (alive.current)
        setWorkerStatus("Couldn’t check for updates. Reconnect and try again.");
    } finally {
      if (alive.current) setChecking(false);
    }
  }, [checking, offerUpdate, retryRegistration]);

  /** Only the rider's button click consumes the browser's one-use install invitation. */
  async function install() {
    if (!installEvent || installBusy) return;
    const invitation = installEvent;
    setInstallEvent(null);
    setInstallBusy(true);
    setInstallMessage("");
    try {
      await invitation.prompt();
      const choice = await invitation.userChoice;
      if (alive.current)
        setInstallMessage(
          choice.outcome === "accepted"
            ? "Installation requested. Follow your browser to finish."
            : "Installation was dismissed. You can still use Hatid in this browser.",
        );
    } catch {
      if (alive.current)
        setInstallMessage(
          "The install prompt is unavailable. Use your browser’s installation menu below.",
        );
    } finally {
      if (alive.current) setInstallBusy(false);
    }
  }

  /** Require an explicit ready-to-reload choice; open business dialogs keep their own save lifecycle. */
  function applyUpdate() {
    if (applying || reloadRequested.current) return;
    if (reloadTimer.current) clearTimeout(reloadTimer.current);
    setUpdateError("");
    if (!mayReloadForUpdate(true, businessDialogOpen())) {
      setUpdateError("Finish and close your open forms before reloading.");
      return;
    }
    const value = registration.current;
    if (
      !value ||
      !offeredWorker.current ||
      offeredWorker.current.state === "redundant"
    ) {
      setUpdateError(
        "This update is no longer waiting. Check again from Settings.",
      );
      return;
    }
    reloadRequested.current = true;
    setApplying(true);
    if (value.waiting) {
      try {
        value.waiting.postMessage({ type: "HATID_APPLY_UPDATE" });
      } catch {
        reloadRequested.current = false;
        setApplying(false);
        setUpdateError(
          "This update changed while you were reviewing it. Check again from Settings.",
        );
        return;
      }
      reloadTimer.current = setTimeout(
        /** Do not reload unexpectedly if an activation arrives long after the rider gave up. */ () => {
          reloadRequested.current = false;
          if (alive.current) {
            setApplying(false);
            setUpdateError(
              "The update hasn’t activated yet. Try again or choose Later.",
            );
          }
        },
        12000,
      );
    } else if (navigator.serviceWorker.controller) {
      reloadRequested.current = false;
      window.location.reload();
    } else {
      reloadRequested.current = false;
      setApplying(false);
      setUpdateError("Reconnect and check for updates again.");
    }
  }

  return (
    <PwaContext.Provider
      value={{
        online,
        installed,
        supported,
        updateReady,
        checking,
        workerStatus,
        openInstall:
          /** Installation is always an explicit rider action. */ () =>
            setInstallOpen(true),
        reviewUpdate:
          /** Offer a confirmation instead of refreshing work immediately. */ () => {
            setUpdateError("");
            setUpdateOpen(true);
          },
        checkUpdates,
      }}
    >
      {children}
      <div className="pwa-notices">
        {online === false && (
          <div className="pwa-notice notice-amber" role="status">
            <WifiOff size={19} />
            <p>
              <strong>Device offline</strong>Committed drafts stay on this
              browser. Reconnect to verify sign-in and review pending saves.
              Nothing is sent automatically.
            </p>
          </div>
        )}
        {online !== false && reconnected && (
          <div className="pwa-notice notice-blue" role="status">
            <p>
              <strong>Network detected</strong>Open Drafts &amp; recovery to
              check interrupted saves. The delivery service may still be
              unavailable.
            </p>
            <button
              className="icon-button"
              aria-label="Dismiss network notice"
              onClick={
                /** Dismiss this connection hint without starting a retry. */ () =>
                  setReconnected(false)
              }
            >
              <X size={16} />
            </button>
          </div>
        )}
        {updateReady && !updateSnoozed && (
          <div className="pwa-notice" role="status">
            <p>
              <strong>A Hatid update is ready</strong>Save your work, then
              reload when you’re ready.
            </p>
            <Button
              onClick={
                /** Review the update without changing the running app. */ () =>
                  setUpdateOpen(true)
              }
            >
              Review
            </Button>
            <Button
              variant="ghost"
              onClick={
                /** Later retains the current screen; Settings can reopen the update. */ () =>
                  setUpdateSnoozed(true)
              }
            >
              Later
            </Button>
          </div>
        )}
      </div>
      <Modal
        open={installOpen}
        onClose={
          /** Closing guidance does not install or change permissions. */ () =>
            setInstallOpen(false)
        }
        title="Install Hatid"
        description="Keep your rider workspace a tap away."
      >
        <div className="dialog-body form-stack">
          {installed ? (
            <div className="notice notice-blue">
              Hatid is installed or running as an app on this device.
            </div>
          ) : (
            <>
              {installEvent && (
                <Button onClick={install} disabled={installBusy}>
                  <Download size={16} />
                  {installBusy
                    ? "Opening installation…"
                    : "Install on this device"}
                </Button>
              )}
              <div className="install-instructions">
                <h3>Android / Chrome</h3>
                <p>
                  Open the browser menu and choose Install app or Add to Home
                  screen.
                </p>
                <h3>iPhone / iPad</h3>
                <p>Open Hatid in Safari. Tap Share, then Add to Home Screen.</p>
                <h3>Desktop</h3>
                <p>
                  Use the install icon in the address bar or the browser’s app
                  installation menu, when available.
                </p>
              </div>
            </>
          )}
          {installMessage && <p role="status">{installMessage}</p>}
          <p className="small-muted">
            Your browser decides whether installation is available. Use a secure
            HTTPS site. The installed app may need its own sign-in; closing it
            can end this tab’s session.
          </p>
          {supported === false && <p className="small-muted">{workerStatus}</p>}
          <p className="small-muted">
            Only public fallback assets are stored offline. Reconnect and verify
            the same rider to access account data and saved local work.
          </p>
        </div>
        <footer className="dialog-footer">
          <Button
            variant="secondary"
            onClick={
              /** Return to the same rider screen. */ () =>
                setInstallOpen(false)
            }
          >
            Done
          </Button>
        </footer>
      </Modal>
      <Modal
        open={updateOpen}
        className="pwa-update-dialog"
        closeDisabled={applying}
        onClose={
          /** Keep the current version and unsaved UI when choosing Later. */ () => {
            setUpdateOpen(false);
            setUpdateSnoozed(true);
          }
        }
        title="Ready to update Hatid?"
        description="Reload only after saving your work."
      >
        <div className="dialog-body form-stack">
          <p>
            Finish saving and close any open forms first. Committed drafts and
            pending operation evidence stay on this browser; unsaved fields on
            this page can be lost on reload.
          </p>
          <p>
            Only this tab will reload. Other open tabs keep their current
            screens until you choose to update them.
          </p>
          {updateError && (
            <p role="alert" className="notice notice-amber">
              {updateError}
            </p>
          )}
        </div>
        <footer className="dialog-footer">
          <Button
            variant="secondary"
            disabled={applying}
            onClick={
              /** Defer without replacing the current screen. */ () => {
                setUpdateOpen(false);
                setUpdateSnoozed(true);
              }
            }
          >
            Later
          </Button>
          <Button disabled={applying} onClick={applyUpdate}>
            <RefreshCw size={16} />
            {applying ? "Applying…" : "Reload when ready"}
          </Button>
        </footer>
      </Modal>
    </PwaContext.Provider>
  );
}

/** Reuse native app state without copying it into auth or demo storage. */
export function usePwa(): PwaActions {
  const context = useContext(PwaContext);
  if (!context) throw new Error("PWA controls require the app provider.");
  return context;
}

/** Keep installation and optional update checks together in the existing Settings layout. */
export function AppInstallCard() {
  const {
    installed,
    supported,
    updateReady,
    checking,
    workerStatus,
    openInstall,
    reviewUpdate,
    checkUpdates,
  } = usePwa();
  return (
    <Card title="Hatid on this device" action={<Smartphone size={20} />}>
      <div className="card-body form-stack">
        <Badge tone={installed ? "green" : "gray"}>
          {installed ? "Installed app" : "Browser workspace"}
        </Badge>
        <p className="small-muted">{workerStatus}</p>
        <Button variant="secondary" onClick={openInstall}>
          <Download size={16} />
          {installed ? "Installation details" : "Install / Add to Home Screen"}
        </Button>
        {supported && (
          <Button
            variant="secondary"
            disabled={checking}
            onClick={updateReady ? reviewUpdate : checkUpdates}
          >
            <RefreshCw size={16} />
            {checking
              ? "Checking…"
              : updateReady
                ? "Review available update"
                : "Check for updates"}
          </Button>
        )}
      </div>
    </Card>
  );
}
