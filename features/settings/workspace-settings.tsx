"use client";

import { useState } from "react";
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
  Package,
  RefreshCw,
  ShieldCheck,
  UserRound,
  Wallet,
} from "lucide-react";
import { prototypeStore, usePrototypeState } from "@/lib/prototype/store";
import { formatDate } from "@/lib/prototype/domain";
import { authApi } from "@/lib/api";
import { useActions } from "@/components/providers";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Field,
  LinkButton,
  Modal,
  PageHeading,
} from "@/components/ui";

export function SettingsScreen() {
  const state = usePrototypeState();
  const { commit, notify, session, setSession } = useActions();
  const router = useRouter();
  const [reset, setReset] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    if (session) {
      try {
        await authApi.logout(session.access_token);
      } catch {
        notify(
          "Signed out locally. Server revocation could not be confirmed.",
          true,
        );
      }
    }
    setSession(null);
    setSigningOut(false);
    router.push("/login");
  }

  return (
    <>
      <PageHeading
        eyebrow="A WORKSPACE THAT WORKS FOR YOU"
        title="Settings"
        description="Your rider profile, preferences, and local prototype controls."
      />
      <div className="settings-layout">
        <div className="form-stack">
          <Card
            title="Rider profile"
            description="Profile edits in this prototype are saved on this device."
            action={<UserRound size={20} />}
          >
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                commit(
                  (current) => ({
                    ...current,
                    settings: {
                      ...current.settings,
                      riderName: String(data.get("name")).trim(),
                      phone: String(data.get("phone")).trim(),
                    },
                  }),
                  "Prototype profile saved.",
                );
              }}
            >
              <div className="card-body form-stack">
                <div className="profile-header">
                  <Avatar name={state.settings.riderName} color="sage" />
                  <div>
                    <h3>{state.settings.riderName}</h3>
                    <Badge tone="green">Independent rider</Badge>
                  </div>
                </div>
                <div className="form-grid">
                  <Field label="Full name" required>
                    <input
                      name="name"
                      defaultValue={state.settings.riderName}
                      required
                      minLength={2}
                      maxLength={100}
                    />
                  </Field>
                  <Field label="Phone">
                    <input
                      name="phone"
                      type="tel"
                      defaultValue={state.settings.phone}
                      maxLength={30}
                    />
                  </Field>
                </div>
              </div>
              <div className="card-form-footer">
                <Button type="submit">
                  <Check size={16} />
                  Save profile
                </Button>
              </div>
            </form>
          </Card>
          <Card
            title="Your preferences"
            description="Keep the information you need close at hand."
          >
            <div className="preference-list">
              <Preference
                title="Delivery update alerts"
                description="Get a local alert when delivery outcomes change."
                checked={state.settings.deliveryAlerts}
                onChange={(value) =>
                  commit(
                    (current) => ({
                      ...current,
                      settings: { ...current.settings, deliveryAlerts: value },
                    }),
                    "Delivery alert preference saved.",
                  )
                }
              />
              <Preference
                title="Collection & remittance alerts"
                description="Highlight new receipt and handover records."
                checked={state.settings.collectionAlerts}
                onChange={(value) =>
                  commit(
                    (current) => ({
                      ...current,
                      settings: {
                        ...current.settings,
                        collectionAlerts: value,
                      },
                    }),
                    "Collection alert preference saved.",
                  )
                }
              />
              <Preference
                title="Compact workspace"
                description="Reduce table spacing when reviewing more parcels."
                checked={state.settings.compactView}
                onChange={(value) =>
                  commit(
                    (current) => ({
                      ...current,
                      settings: { ...current.settings, compactView: value },
                    }),
                    "Workspace density updated.",
                  )
                }
              />
            </div>
          </Card>
          <Card
            title="Prototype controls"
            description="Try the flows before business APIs are connected."
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
                    {formatDate(session.expires_at, true)} or you sign out.
                    Prototype delivery records stay local.
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
              <Button variant="ghost" onClick={signOut} disabled={signingOut}>
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

function Preference({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
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
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="switch-control" />
    </label>
  );
}

export function NotificationsScreen() {
  const state = usePrototypeState();
  const { commit } = useActions();
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
        <div className="notification-list">
          {state.activity.map((event) => (
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
