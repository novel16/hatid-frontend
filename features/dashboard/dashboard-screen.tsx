"use client";

import {
  AddParcelButton,
  useParcelEntry,
} from "@/features/parcels/parcel-entry-screen";
import { useEffect, useState } from "react";

import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCheck,
  Clock,
  Package,
  Plus,
  RefreshCw,
  Sparkles,
  Wallet,
} from "lucide-react";
import { usePrototypeState } from "@/lib/prototype/store";
import {
  formatDate,
  getStops,
  money,
  totals,
  selectBatch,
} from "@/lib/prototype/domain";
import { useActions } from "@/components/providers";
import {
  Badge,
  Button,
  Card,
  LinkButton,
  PageHeading,
  SectionLink,
} from "@/components/ui";
import { NextStopCard, StopTable } from "@/components/delivery-ui";
import { AccountDeliveriesScreen } from "@/features/deliveries/account-deliveries";
import { errorMessage, type DashboardReport } from "@/lib/api";

/** Account navigation shows actual work; prototype metrics and sample IDs stay in demo mode. */
export function DashboardScreen() {
  const { session } = useActions();
  return session ? (
    <AccountDashboard key={session.user.id} name={session.user.name} />
  ) : (
    <DemoDashboard />
  );
}

/** Keeps the original interactive sample overview isolated from authenticated account reports. */
function DemoDashboard() {
  const state = usePrototypeState();
  const { commit } = useActions();
  const riderName = state.settings.riderName;
  const summary = totals(state, state.selectedBatchId);
  const batch = state.batches.find((item) => item.id === state.selectedBatchId);
  const goal = Math.max(1, summary.count);
  const progress = Math.min(100, (summary.delivered / goal) * 100);
  return (
    <div className="dashboard-screen">
      <PageHeading
        eyebrow="A FRESH START, A CLEAR ROUTE"
        title={`Magandang araw, ${riderName.split(" ")[0]}.`}
        description={`${summary.pending} parcels ready to deliver. Let’s take it one stop at a time.`}
      >
        <select
          aria-label="Active weekly batch"
          value={state.selectedBatchId}
          onChange={(event) =>
            commit((current) => selectBatch(current, event.target.value))
          }
        >
          {state.batches.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} · {formatDate(item.start)}
            </option>
          ))}
        </select>
        <AddParcelButton>
          <Plus size={17} />
          Add parcel
        </AddParcelButton>
      </PageHeading>
      <div className="dashboard-layout">
        <div className="metrics dashboard-metrics">
          {[
            {
              label: "Ready to deliver",
              value: summary.pending,
              detail: `${getStops(state).filter((stop) => stop.parcels.some((parcel) => parcel.status === "pending")).length} customer stops`,
              icon: Package,
              tone: "sage",
            },
            {
              label: "Delivered",
              value: summary.delivered,
              detail: `of ${summary.count} parcels this batch`,
              icon: CheckCheck,
              tone: "sage",
            },
            {
              label: "Recorded collections",
              value: money(summary.cash + summary.gcash),
              detail: "Cash + rider-confirmed GCash",
              icon: Wallet,
              tone: "blue",
            },
            {
              label: "My retained earnings",
              value: money(summary.fees),
              detail: "Delivery fees already included",
              icon: ArrowUpRight,
              tone: "peach",
            },
          ].map(({ label, value, detail, icon: Icon, tone }) => (
            <section className="metric-card" key={label}>
              <div>
                <p>{label}</p>
                <span className={`metric-icon avatar-${tone}`}>
                  <Icon size={18} />
                </span>
              </div>
              <strong>{value}</strong>
              <small>{detail}</small>
            </section>
          ))}
        </div>
        <div className="dashboard-next">
          <NextStopCard />
        </div>
        <Card
          className="dashboard-goal"
          title="A little closer, every stop"
          action={
            <span className="subtle-icon">
              <Sparkles size={18} />
            </span>
          }
        >
          <div className="goal-content">
            <div className="progress-ring">
              <svg viewBox="0 0 140 140" aria-hidden="true">
                <circle
                  cx="70"
                  cy="70"
                  r="58"
                  fill="none"
                  stroke="var(--line-soft)"
                  strokeWidth="10"
                />
                <circle
                  cx="70"
                  cy="70"
                  r="58"
                  fill="none"
                  stroke="var(--brand)"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={`${(progress / 100) * 364.4} 364.4`}
                  transform="rotate(-90 70 70)"
                />
              </svg>
              <span>
                <strong>
                  {summary.delivered}
                  <small>/{goal}</small>
                </strong>
                <small>parcels in this batch</small>
              </span>
            </div>
            <div className="goal-legend">
              <span>
                <i className="legend-green" />
                Delivered<b>{summary.delivered}</b>
              </span>
              <span>
                <i className="legend-gray" />
                To deliver<b>{summary.pending}</b>
              </span>
              <span>
                <i className="legend-amber" />
                On hold<b>{summary.held}</b>
              </span>
              <span>
                <i style={{ background: "var(--red)" }} />
                Failed<b>{summary.failed}</b>
              </span>
            </div>
          </div>
          <div className="goal-note">
            <Check size={13} />
            Every confirmed handover counts.
          </div>
        </Card>
        <Card
          className="dashboard-deliveries"
          title="Your deliveries"
          description={`${batch?.name} · ${summary.count} parcels in your batch`}
          action={<SectionLink href="/deliveries">View all</SectionLink>}
        >
          <StopTable stops={getStops(state).slice(0, 5)} />
          <div className="card-table-footer">
            <span>
              <span className="tiny-dot" />
              Showing your first 5 customer stops
            </span>
            <SectionLink href="/deliveries">Open delivery list</SectionLink>
          </div>
        </Card>
        <Card
          className="dashboard-money"
          title="Keep your money clear"
          action={
            <span className="subtle-icon">
              <Wallet size={18} />
            </span>
          }
        >
          <div className="money-breakdown">
            <div>
              <span>
                <i className="legend-green" />
                Recorded cash
              </span>
              <strong>{money(summary.cash)}</strong>
            </div>
            <div>
              <span>
                <i className="legend-blue" />
                Recorded GCash
              </span>
              <strong>{money(summary.gcash)}</strong>
            </div>
            <div className="money-divider">
              <span>Seller share outstanding</span>
              <strong>{money(summary.outstanding)}</strong>
            </div>
          </div>
          <p className="small-muted">
            Your fees stay with you. Remit only each seller’s net share.
          </p>
          <SectionLink href="/collections">Review collections</SectionLink>
        </Card>
        <Card
          className="dashboard-activity"
          title="Latest on your route"
          action={<SectionLink href="/notifications">All activity</SectionLink>}
        >
          <div className="activity-list">
            {state.activity.slice(0, 3).map((event) => (
              <Link key={event.id} href={event.href} className="activity-item">
                <span
                  className={`activity-icon ${event.type === "money" ? "activity-money" : ""}`}
                >
                  {event.type === "money" ? (
                    <ArrowDownLeft size={15} />
                  ) : event.type === "delivery" ? (
                    <Check size={15} />
                  ) : (
                    <Clock size={15} />
                  )}
                </span>
                <div>
                  <strong>{event.title}</strong>
                  <p>{event.detail}</p>
                  <small>{formatDate(event.at, true)}</small>
                </div>
                <ArrowRight size={13} />
              </Link>
            ))}
          </div>
        </Card>
      </div>
      <div className="dashboard-bottom-note">
        <Badge tone="green">
          <CheckCheck size={13} />
          Your workspace is ready
        </Badge>
        <span>
          Plan the week. Deliver with confidence. Settle with clarity.
        </span>
      </div>
    </div>
  );
}

/** Shows today's real receipts/fees while open work and seller debt retain their lifetime scopes. */
function AccountDashboard({ name }: { name: string }) {
  const { request } = useActions();
  const { revision: parcelRevision } = useParcelEntry();
  const [revision, setRevision] = useState(0);
  const [snapshot, setSnapshot] = useState<{
    key: string;
    data: DashboardReport | null;
    error: string;
  } | null>(null);
  const key = `${revision}:${parcelRevision}`;

  /** Parcel saves and explicit refreshes replace the summary only after a current successful read. */
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    /** The API owns the Manila calendar date and money scopes; the client never substitutes demo totals. */
    async function load() {
      try {
        const response = await request<{ data: DashboardReport }>(
          "/dashboard",
          "GET",
          undefined,
          { signal: controller.signal },
        );
        if (active) setSnapshot({ key, data: response.data, error: "" });
      } catch (cause) {
        if (active)
          setSnapshot({
            key,
            data: null,
            error: errorMessage(cause, "Unable to load dashboard totals."),
          });
      }
    }
    void load();
    /** Discard older account/navigation/parcel revisions without affecting manual delivery access. */
    return () => {
      active = false;
      controller.abort();
    };
  }, [request, key]);

  /** Recheck statistics on demand without starting polling or map/provider calls. */
  function refresh() {
    setRevision(
      /** Mark the old snapshot unavailable before its replacement arrives. */ (
        current,
      ) => current + 1,
    );
  }

  const loading = snapshot?.key !== key;
  const data = !loading ? snapshot?.data : null;
  const error = !loading ? snapshot?.error : "";
  return (
    <>
      <PageHeading
        eyebrow="YOUR RIDER WORKSPACE"
        title={`Magandang araw, ${name.split(" ")[0]}.`}
        description="Continue open deliveries across intake weeks and see your actual confirmed earnings."
      >
        <LinkButton href="/batches" variant="secondary">
          Weekly batches
        </LinkButton>
        <AddParcelButton />
      </PageHeading>
      <div className="section-summary">
        <Badge tone="green">
          {data
            ? `Today · ${data.period.start} · Asia/Manila`
            : "Dashboard totals"}
        </Badge>
        <Button variant="ghost" disabled={loading} onClick={refresh}>
          <RefreshCw size={15} /> Refresh totals
        </Button>
        {loading && <span role="status">Loading actual totals…</span>}
      </div>
      {error && (
        <div className="notice notice-amber" role="alert">
          <p>{error} Your delivery list remains available below.</p>
        </div>
      )}
      <div className="metrics">
        {[
          {
            label: "Ready to deliver",
            value: data?.work.ready ?? "—",
            detail: "Across all intake weeks",
            icon: Package,
            tone: "sage",
          },
          {
            label: "Confirmed today",
            value: data?.summary.receipts ?? "—",
            detail: "Delivered with full payment received",
            icon: CheckCheck,
            tone: "blue",
          },
          {
            label: "Recorded collections today",
            value: data ? money(data.summary.total) : "—",
            detail: data
              ? `Cash ${money(data.summary.cash)} · GCash ${money(data.summary.gcash)}`
              : "Actual cash and rider-confirmed GCash",
            icon: Wallet,
            tone: "peach",
          },
          {
            label: "Your retained fees today",
            value: data ? money(data.summary.fees) : "—",
            detail: "Recognized by confirmation date",
            icon: ArrowUpRight,
            tone: "purple",
          },
        ].map(
          /** Unavailable statistics show a dash instead of invented zero values. */ ({
            label,
            value,
            detail,
            icon: Icon,
            tone,
          }) => (
            <div className="metric-card" key={label}>
              <div>
                <p>{label}</p>
                <span className={`metric-icon avatar-${tone}`}>
                  <Icon size={18} />
                </span>
              </div>
              <strong>{value}</strong>
              <small>{detail}</small>
            </div>
          ),
        )}
      </div>
      <div className="directory-toolbar">
        <p className="text-muted">
          {data
            ? `${data.work.open} open parcels · ${data.work.held} on hold · ${data.work.failed} failed`
            : "Open work keeps its original batch and delivery history."}
        </p>
        <LinkButton href="/earnings" variant="secondary">
          Earnings & reports <ArrowRight size={15} />
        </LinkButton>
      </div>
      <Card
        title="Seller share outstanding"
        description="Lifetime account balance after recorded handovers; separate from today's earnings."
        action={
          <LinkButton href="/collections" variant="ghost">
            Review collections <ArrowRight size={15} />
          </LinkButton>
        }
      >
        <div className="card-body">
          <strong className="text-green">
            {data ? money(data.seller_outstanding) : "—"}
          </strong>
          <p className="text-muted">
            Recorded receipts and balances are not a live GCash wallet or
            physical cash count.
          </p>
        </div>
      </Card>
      <AccountDeliveriesScreen embedded />
    </>
  );
}
