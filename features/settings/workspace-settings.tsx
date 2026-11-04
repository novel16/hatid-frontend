"use client";

import { useState, type SyntheticEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Bell,
  Check,
  CheckCheck,
  ChevronRight,
  CloudCheck,
  CloudOff,
  Database,
  LogOut,
  MonitorSmartphone,
  Package,
  RefreshCw,
  ShieldCheck,
  UserRound,
  Wallet,
} from "lucide-react";
import { prototypeStore, usePrototypeState } from "@/lib/prototype/store";
import { formatDate } from "@/lib/prototype/domain";
import {
  ApiError,
  errorMessage,
  type AccountPreferences,
  type Vehicle,
} from "@/lib/api";
import { DevicesPanel } from "@/features/settings/devices-panel";
import { useActions } from "@/components/providers";
import {
  Pagination,
  PaginationEntries,
  usePagination,
} from "@/components/pagination";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Field,
  LinkButton,
  Modal,
  PageHeading,
  PasswordInput,
  VehicleSelect,
} from "@/components/ui";

/** Saves real account settings while keeping sample profiles and controls separate. */
export function SettingsScreen() {
  const state = usePrototypeState();
  const { commit, notify, session, signOut, changePassword, saveSettings } =
    useActions();
  const router = useRouter();
  const [reset, setReset] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileErrors, setProfileErrors] = useState<Record<string, string[]>>(
    {},
  );
  const [preferenceBusy, setPreferenceBusy] = useState(false);
  const settingsBusy = profileBusy || preferenceBusy;
  const profile = session?.user ?? {
    name: state.settings.riderName,
    phone: state.settings.phone,
  };
  const preferences = session?.user.preferences ?? state.settings;

  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordErrors, setPasswordErrors] = useState<
    Record<string, string[]>
  >({});

  /** Ends local access and attempts revocation of this device's token. */
  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
    router.replace("/login");
  }

  /** Preserves entered values after failure and never copies real profile data to the sample store. */
  async function saveProfile(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (settingsBusy) return;
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const phone = String(data.get("phone") ?? "").trim();
    setProfileBusy(true);
    setProfileError("");
    setProfileErrors({});
    try {
      if (session) {
        await saveSettings({
          name,
          phone: phone || null,
          vehicle: String(data.get("vehicle") ?? "") as Vehicle,
        });
        notify("Profile saved to your account.");
      } else {
        commit(
          /** Sample edits are deliberately isolated from the signed-in account. */
          (current) => ({
            ...current,
            settings: { ...current.settings, riderName: name, phone },
          }),
          "Sample profile saved on this device.",
        );
      }
    } catch (cause) {
      setProfileError(errorMessage(cause));
      if (cause instanceof ApiError) setProfileErrors(cause.errors);
    } finally {
      setProfileBusy(false);
    }
  }

  /** Saves one account preference at a time and applies the confirmed server result. */
  async function savePreference(key: keyof AccountPreferences, value: boolean) {
    if (settingsBusy) return;
    if (!session) {
      commit(
        /** Demo preferences affect only local sample activity. */
        (current) => ({
          ...current,
          settings: { ...current.settings, [key]: value },
        }),
        "Sample preference saved.",
      );
      return;
    }
    setPreferenceBusy(true);
    try {
      await saveSettings({ preferences: { [key]: value } });
      notify("Preference saved to your account.");
    } catch (cause) {
      notify(errorMessage(cause), true);
    } finally {
      setPreferenceBusy(false);
    }
  }

  return (
    <>
      <PageHeading
        eyebrow="A WORKSPACE THAT WORKS FOR YOU"
        title="Settings"
        description="Your rider profile, account security, and workspace preferences."
      />
      <div className="settings-layout">
        <div className="form-stack">
          <Card
            title={session ? "Rider profile" : "Sample rider profile"}
            description={
              session
                ? "Your name, contact number and primary vehicle are saved to your account."
                : "Demo profile edits are saved only on this device."
            }
            action={<UserRound size={20} />}
          >
            <form
              key={session?.user.id ?? "demo"}
              method="post"
              onSubmit={saveProfile}
            >
              <div className="card-body form-stack">
                {profileError && (
                  <div className="form-error" role="alert">
                    {profileError}
                  </div>
                )}
                <div className="profile-header">
                  <Avatar name={profile.name} color="sage" />
                  <div>
                    <h3>{profile.name}</h3>
                    <Badge tone="green">Independent rider</Badge>
                  </div>
                </div>
                <div className="form-grid">
                  <Field
                    label="Full name"
                    required
                    error={profileErrors.name?.[0]}
                  >
                    <input
                      name="name"
                      defaultValue={profile.name}
                      autoComplete="name"
                      disabled={settingsBusy}
                      aria-invalid={!!profileErrors.name}
                      required
                      minLength={2}
                      maxLength={255}
                    />
                  </Field>
                  <Field
                    label="Phone"
                    error={profileErrors.phone?.[0]}
                    hint="Optional contact number."
                  >
                    <input
                      name="phone"
                      type="tel"
                      defaultValue={profile.phone ?? ""}
                      autoComplete="tel"
                      disabled={settingsBusy}
                      aria-invalid={!!profileErrors.phone}
                      maxLength={30}
                    />
                  </Field>
                  {session && (
                    <Field
                      label="Primary vehicle"
                      required
                      error={profileErrors.vehicle?.[0]}
                      hint="Road recommendations use this vehicle. Existing accounts must choose one."
                    >
                      <VehicleSelect
                        name="vehicle"
                        defaultValue={session.user.vehicle ?? ""}
                        required
                        disabled={settingsBusy}
                        aria-invalid={!!profileErrors.vehicle}
                      />
                    </Field>
                  )}
                  {session && (
                    <Field
                      label="Email address"
                      hint="Your sign-in email is read-only here."
                    >
                      <input
                        type="email"
                        value={session.user.email}
                        readOnly
                        autoComplete="email"
                      />
                    </Field>
                  )}
                </div>
              </div>
              <div className="card-form-footer">
                <Button type="submit" disabled={settingsBusy}>
                  <Check size={16} />
                  {profileBusy ? "Saving…" : "Save profile"}
                </Button>
              </div>
            </form>
          </Card>
          <Card
            title="Your preferences"
            description={
              session
                ? "Saved to your account. Delivery activity currently uses sample data."
                : "These preferences apply to this device's sample workspace."
            }
          >
            <div className="preference-list">
              <Preference
                title="Delivery update alerts"
                description="Show in-app alerts for delivery outcome updates."
                checked={preferences.deliveryAlerts}
                disabled={settingsBusy}
                onChange={(value) => savePreference("deliveryAlerts", value)}
              />
              <Preference
                title="Collection & remittance alerts"
                description="Highlight new receipt and handover records."
                checked={preferences.collectionAlerts}
                disabled={settingsBusy}
                onChange={(value) => savePreference("collectionAlerts", value)}
              />
              <Preference
                title="Compact workspace"
                description="Reduce table spacing when reviewing more parcels."
                checked={preferences.compactView}
                disabled={settingsBusy}
                onChange={(value) => savePreference("compactView", value)}
              />
            </div>
          </Card>
          {session ? (
            <DevicesPanel />
          ) : (
            <Card
              title="Signed-in devices"
              action={<MonitorSmartphone size={20} />}
            >
              <div className="card-body">
                <p className="small-muted">
                  Sign in to review and manage your account&apos;s active
                  sign-ins. Demo mode has no account devices.
                </p>
              </div>
            </Card>
          )}
          <Card
            title="Sample workspace controls"
            description="These controls affect sample delivery data only, never your account settings."
          >
            <div className="setting-action-row">
              <div>
                <h3>Reset demo data</h3>
                <p>Restore sample parcels, customers and money records.</p>
              </div>
              <Button variant="secondary" onClick={() => setReset(true)}>
                <RefreshCw size={15} />
                Reset prototype
              </Button>
            </div>
            <div className="setting-action-row">
              <div>
                <h3>Guided introduction</h3>
                <p>See how batches, delivery and settlement fit together.</p>
              </div>
              <LinkButton href="/welcome" variant="secondary">
                Open tour
                <ArrowRight size={15} />
              </LinkButton>
            </div>
          </Card>
        </div>
        <aside className="form-stack">
          <Card title="Your account" action={<ShieldCheck size={19} />}>
            <div className="card-body form-stack">
              {session ? (
                <>
                  <Badge tone="green">Rider account connected</Badge>
                  <h3>{session.user.name}</h3>
                  <p className="small-muted">{session.user.email}</p>
                  <p className="small-muted">
                    This sign-in lasts until{" "}
                    {formatDate(session.expires_at, true)} or you sign out. This
                    tab keeps your sign-in through refresh and checks it with
                    Hatid again. Closing the tab ends local access but does not
                    revoke its sign-in token. Use the device list to revoke it.
                  </p>
                </>
              ) : (
                <>
                  <Badge tone="blue">Exploring the prototype</Badge>
                  <p className="small-muted">
                    You can try every rider flow with sample data, or sign in
                    with your own rider account.
                  </p>
                  <LinkButton href="/login" variant="secondary">
                    Sign in
                    <ArrowRight size={15} />
                  </LinkButton>
                </>
              )}
              {session && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setPasswordError("");
                    setPasswordErrors({});
                    setPasswordOpen(true);
                  }}
                >
                  Change password
                </Button>
              )}
              <Button
                variant="ghost"
                onClick={handleSignOut}
                disabled={signingOut}
              >
                <LogOut size={15} />
                {signingOut
                  ? "Signing out…"
                  : session
                    ? "Sign out"
                    : "Exit demo"}
              </Button>
            </div>
          </Card>
          <Card
            title="Offline & sync"
            action={
              state.offline ? <CloudOff size={20} /> : <CloudCheck size={20} />
            }
          >
            <div className="card-body form-stack">
              <Badge tone={state.offline ? "amber" : "green"}>
                {state.offline ? "Offline simulation" : "Online prototype"}
              </Badge>
              <p className="small-muted">
                {state.pendingChanges} local change(s) waiting in the demo sync
                queue.
              </p>
              <LinkButton href="/sync" variant="secondary">
                Manage sync
                <ChevronRight size={15} />
              </LinkButton>
            </div>
          </Card>
          <div className="settings-brand-note">
            <Package size={23} />
            <strong>hatid.</strong>
            <p>
              Less paperwork.
              <br />
              More parcels delivered.
            </p>
            <small>Rider prototype · v0.1</small>
          </div>
        </aside>
      </div>
      {passwordOpen && (
        <Modal
          open={passwordOpen}
          onClose={() => {
            if (!passwordBusy) setPasswordOpen(false);
          }}
          title="Change your password"
          description="A successful change signs you out on every device."
        >
          <form
            method="post"
            onSubmit={async (event) => {
              event.preventDefault();
              if (passwordBusy) return;
              setPasswordBusy(true);
              setPasswordError("");
              setPasswordErrors({});
              const data = new FormData(event.currentTarget);
              try {
                await changePassword({
                  current_password: String(data.get("current_password") ?? ""),
                  password: String(data.get("password") ?? ""),
                  password_confirmation: String(
                    data.get("password_confirmation") ?? "",
                  ),
                });
                router.replace("/login");
              } catch (cause) {
                setPasswordError(errorMessage(cause));
                if (cause instanceof ApiError) setPasswordErrors(cause.errors);
              } finally {
                setPasswordBusy(false);
              }
            }}
          >
            <div className="dialog-body form-stack">
              {passwordError && (
                <div className="form-error" role="alert">
                  {passwordError}
                </div>
              )}
              <Field
                label="Current password"
                required
                error={passwordErrors.current_password?.[0]}
              >
                <PasswordInput
                  name="current_password"
                  required
                  maxLength={72}
                  autoComplete="current-password"
                  aria-invalid={!!passwordErrors.current_password}
                />
              </Field>
              <Field
                label="New password"
                required
                error={passwordErrors.password?.[0]}
                hint="At least 12 characters, with upper/lowercase and a number."
              >
                <PasswordInput
                  name="password"
                  required
                  minLength={12}
                  maxLength={72}
                  autoComplete="new-password"
                  aria-invalid={!!passwordErrors.password}
                />
              </Field>
              <Field
                label="Confirm new password"
                required
                error={passwordErrors.password_confirmation?.[0]}
              >
                <PasswordInput
                  name="password_confirmation"
                  required
                  minLength={12}
                  maxLength={72}
                  autoComplete="new-password"
                  aria-invalid={!!passwordErrors.password_confirmation}
                />
              </Field>
            </div>
            <footer className="dialog-footer">
              <Button
                variant="secondary"
                disabled={passwordBusy}
                onClick={() => setPasswordOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={passwordBusy}>
                {passwordBusy ? "Updating…" : "Update password"}
              </Button>
            </footer>
          </form>
        </Modal>
      )}
      <Modal
        open={reset}
        onClose={() => setReset(false)}
        title="Restore the sample workspace?"
        description="This clears local prototype changes and brings back the original sample records."
      >
        <div className="dialog-body">
          <div className="notice notice-amber">
            <Database size={19} />
            <p>
              Parcels, customers, seller preferences and remittance records you
              added in this prototype will be reset.
            </p>
          </div>
        </div>
        <footer className="dialog-footer">
          <Button variant="secondary" onClick={() => setReset(false)}>
            Keep my changes
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              prototypeStore.reset();
              setReset(false);
              notify("Sample workspace restored.");
            }}
          >
            Reset demo data
          </Button>
        </footer>
      </Modal>
    </>
  );
}

/** Reuses the accessible switch for both sample and server-confirmed preferences. */
function Preference({
  title,
  description,
  checked,
  onChange,
  disabled = false,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="preference-row">
      <span>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={
          /** Only expose the native checkbox's boolean state to its caller. */
          (event) => onChange(event.target.checked)
        }
      />
      <span className="switch-control" />
    </label>
  );
}

/** Pages the activity list while marking notifications read across the whole workspace. */
export function NotificationsScreen() {
  const state = usePrototypeState();
  const { commit } = useActions();
  const pagination = usePagination(state.activity);
  return (
    <>
      <PageHeading
        eyebrow="A CLEAR PICTURE OF YOUR DAY"
        title="Activity & notifications"
        description="Delivery updates, collection records, and the little things worth a look."
      >
        <Button
          variant="secondary"
          onClick={() =>
            commit(
              (current) => ({ ...current, notificationsRead: true }),
              "All notifications marked as read.",
            )
          }
          disabled={state.notificationsRead}
        >
          <CheckCheck size={16} />
          Mark all as read
        </Button>
        <LinkButton href="/settings" variant="secondary">
          Preferences
          <ArrowRight size={15} />
        </LinkButton>
      </PageHeading>
      <Card>
        <div className="table-toolbar">
          <PaginationEntries
            {...pagination.controls}
            label="Notifications pagination"
          />
        </div>
        <div className="notification-list">
          {pagination.items.map((event) => (
            <Link
              key={event.id}
              href={event.href}
              className={`notification-item ${state.notificationsRead ? "notification-read" : ""}`}
            >
              <span
                className={`notification-icon ${event.type === "money" ? "notification-money" : event.type === "notice" ? "notification-notice" : ""}`}
              >
                {event.type === "money" ? (
                  <Wallet size={21} />
                ) : event.type === "delivery" ? (
                  <CheckCheck size={21} />
                ) : (
                  <Bell size={21} />
                )}
              </span>
              <div>
                <h3>
                  {event.title}
                  {!state.notificationsRead && <i />}
                </h3>
                <p>{event.detail}</p>
                <small>{formatDate(event.at, true)}</small>
              </div>
              <ChevronRight size={18} />
            </Link>
          ))}
        </div>
        <Pagination {...pagination.controls} label="Notifications pagination" />
      </Card>
    </>
  );
}

export function SyncScreen() {
  const state = usePrototypeState();
  const { commit } = useActions();
  return (
    <>
      <PageHeading
        eyebrow="KEEP GOING, EVEN WHEN SIGNAL DOESN’T"
        title="Offline & sync"
        description="Try reconnecting without losing a delivery, receipt or customer pin."
      />
      <div className="sync-layout">
        <Card>
          <div
            className={`sync-hero ${state.offline ? "sync-hero-offline" : ""}`}
          >
            <span>
              {state.offline ? (
                <CloudOff size={34} />
              ) : (
                <CloudCheck size={34} />
              )}
            </span>
            <Badge tone={state.offline ? "amber" : "green"}>
              {state.offline ? "Offline simulation" : "Online prototype"}
            </Badge>
            <h2>
              {state.offline
                ? "Your work stays on this device."
                : "Everything is saved locally."}
            </h2>
            <p>
              {state.offline
                ? "You can record a delivery, hold an attempt, or add a customer. Fresh recommendations and remittance confirmation need a connection."
                : "Prototype sync simulates reconnecting. Your sample delivery data is kept in this browser."}
            </p>
            <div className="sync-count">
              <strong>{state.pendingChanges}</strong>
              <span>local changes in demo queue</span>
            </div>
            <div className="sync-actions">
              <Button
                variant="secondary"
                onClick={() =>
                  commit(
                    (current) => ({ ...current, offline: !current.offline }),
                    state.offline
                      ? "Reconnected to the online prototype."
                      : "Offline simulation enabled.",
                  )
                }
              >
                {state.offline ? (
                  <CloudCheck size={16} />
                ) : (
                  <CloudOff size={16} />
                )}
                {state.offline ? "Reconnect" : "Simulate offline"}
              </Button>
              <Button
                disabled={state.offline || state.pendingChanges === 0}
                onClick={() =>
                  commit(
                    (current) => ({ ...current, pendingChanges: 0 }),
                    "Demo sync complete. Delivery and money records are preserved.",
                  )
                }
              >
                <RefreshCw size={16} />
                Sync demo changes
              </Button>
            </div>
          </div>
        </Card>
        <div className="form-stack">
          <Card title="What stays available">
            <div className="sync-capability-list">
              {[
                "Record per-parcel deliveries",
                "Confirm received payments manually",
                "Save customer and parcel entries",
                "Record hold and failed attempts",
                "Browse saved customer addresses",
              ].map((item) => (
                <div key={item}>
                  <Check size={16} />
                  <span>{item}</span>
                  <Badge tone="green">Local</Badge>
                </div>
              ))}
            </div>
          </Card>
          <Card title="Reconnect for these actions">
            <div className="sync-capability-list">
              {[
                "Fresh road recommendations",
                "Confirm seller remittances",
                "Sign in to your account",
              ].map((item) => (
                <div key={item}>
                  <CloudCheck size={17} />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </Card>
          <div className="notice">
            <ShieldCheck size={18} />
            <p>
              Reconnecting does not create a second receipt or add a delivery
              fee again.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
