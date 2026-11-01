"use client";

import { useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  CalendarDays,
  ChartColumnIncreasing,
  CheckCheck,
  Wallet,
} from "lucide-react";
import { usePrototypeState } from "@/lib/prototype/store";
import { formatDate, money, totals } from "@/lib/prototype/domain";
import { useActions } from "@/components/providers";
import { Badge, Button, Card, PageHeading, exportCsv } from "@/components/ui";

export function EarningsScreen() {
  const state = usePrototypeState();
  const { notify } = useActions();
  const [period, setPeriod] = useState(state.selectedBatchId);
  const [metric, setMetric] = useState("fees");
  const batch = state.batches.find((item) => item.id === period);
  const summary = totals(state, period === "all" ? undefined : period);
  const receipts = state.parcels.filter(
    (parcel) =>
      parcel.receipt &&
      parcel.status === "delivered" &&
      (period === "all" || parcel.batchId === period),
  );
  const start = new Date(`${batch?.start ?? "2026-10-26"}T00:00:00+08:00`);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + index);
    const day = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
    }).format(date);
    const matching = receipts.filter(
      (parcel) =>
        new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(
          new Date(parcel.receipt!.confirmedAt),
        ) === day,
    );
    return {
      label: new Intl.DateTimeFormat("en-PH", {
        weekday: "short",
        timeZone: "Asia/Manila",
      }).format(date),
      fees: matching.reduce((sum, parcel) => sum + parcel.pricing.fee, 0),
      count: matching.length,
    };
  });
  const highest = Math.max(
    1,
    ...days.map((day) => (metric === "fees" ? day.fees : day.count)),
  );
  const exportReport = () => {
    exportCsv("hatid-rider-report.csv", [
      [
        "Parcel",
        "Customer",
        "Payment received PHP",
        "Rider fee PHP",
        "Seller share PHP",
        "Confirmed at",
      ],
      ...receipts.map((parcel) => [
        parcel.reference,
        state.customers.find((customer) => customer.id === parcel.customerId)
          ?.name ?? "",
        parcel.pricing.total / 100,
        parcel.pricing.fee / 100,
        parcel.pricing.sellerShare / 100,
        parcel.receipt!.confirmedAt,
      ]),
    ]);
    notify("Your rider report was downloaded.");
  };
  return (
    <>
      <PageHeading
        eyebrow="EVERY SUCCESSFUL HANDOVER COUNTS"
        title="Your work, your earnings."
        description="Retained delivery fees, confirmed receipts, and a clear view of your week."
      >
        <select
          aria-label="Report period"
          value={period}
          onChange={(event) => setPeriod(event.target.value)}
        >
          {state.batches.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
            </option>
          ))}
          <option value="all">All workspace records</option>
        </select>
        <Button onClick={exportReport}>
          <ArrowDownToLine size={16} />
          Download report
        </Button>
      </PageHeading>
      <div className="metrics">
        {[
          {
            label: "Your retained earnings",
            value: money(summary.fees),
            detail: "Fees earned at confirmed delivery",
            icon: ArrowUpRight,
            tone: "sage",
          },
          {
            label: "Successful parcels",
            value: summary.delivered,
            detail: "Handed over and payment received",
            icon: CheckCheck,
            tone: "blue",
          },
          {
            label: "Recorded collections",
            value: money(summary.cash + summary.gcash),
            detail: "Cash and rider-confirmed GCash",
            icon: Wallet,
            tone: "peach",
          },
          {
            label: "Seller balance outstanding",
            value: money(summary.outstanding),
            detail: "After recorded handovers",
            icon: ChartColumnIncreasing,
            tone: "purple",
          },
        ].map(({ label, value, detail, icon: Icon, tone }) => (
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
        ))}
      </div>
      <div className="report-grid">
        <Card
          title={
            metric === "fees"
              ? "A week of earned delivery fees"
              : "Your successful deliveries"
          }
          description={`${batch ? formatDate(batch.start) + " – " + formatDate(batch.end) : "Sample week, Oct 26 – Nov 1"} · ${period === "all" ? "chart shows the sample week" : "confirmed receipts only"}`}
          action={
            <div className="segmented segmented-small">
              <button
                className={metric === "fees" ? "selected" : ""}
                onClick={() => setMetric("fees")}
              >
                Earnings
              </button>
              <button
                className={metric === "count" ? "selected" : ""}
                onClick={() => setMetric("count")}
              >
                Parcels
              </button>
            </div>
          }
        >
          <div className="earnings-chart">
            <div className="chart-gridlines">
              <span />
              <span />
              <span />
              <span />
            </div>
            {days.map((day) => {
              const value = metric === "fees" ? day.fees : day.count;
              return (
                <div className="chart-column" key={day.label}>
                  <span className="chart-value">
                    {metric === "fees" ? money(value) : value}
                  </span>
                  <span
                    className={`chart-bar ${value === highest ? "chart-bar-highlight" : ""}`}
                    style={{
                      height: `${Math.max(3, (value / highest) * 100)}%`,
                    }}
                    title={`${day.label}: ${metric === "fees" ? money(value) : `${value} parcels`}`}
                  />
                  <span className="chart-day">{day.label}</span>
                </div>
              );
            })}
          </div>
          <div className="chart-footer">
            <span>
              <i className="legend-green" />
              {metric === "fees"
                ? "Retained delivery fees"
                : "Confirmed parcels"}
            </span>
            <Badge tone="green">No fee counted twice</Badge>
          </div>
        </Card>
        <section className="earnings-note">
          <div>
            <Wallet size={25} />
          </div>
          <span className="eyebrow">WHAT YOU KEEP</span>
          <h2>Your delivery fee is already yours.</h2>
          <p>
            When a customer pays ₱115 with an included ₱15 fee, you retain ₱15
            and owe the seller ₱100.
          </p>
          <div>
            <span>
              Customer pays<strong>₱115</strong>
            </span>
            <span>
              Seller’s share<strong>₱100</strong>
            </span>
            <span>
              Your retained fee<strong>₱15</strong>
            </span>
          </div>
          <small>
            Remitting the seller’s share does not add or remove that earned fee
            again.
          </small>
        </section>
      </div>
      <Card
        title="Your delivery fee ledger"
        description="One earning record per successfully paid parcel."
        action={
          <Badge tone="gray">
            <CalendarDays size={13} />
            {receipts.length} confirmed parcels
          </Badge>
        }
      >
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Parcel</th>
                <th>Seller</th>
                <th>Delivered</th>
                <th>Customer receipt</th>
                <th>Seller share</th>
                <th>Your earnings</th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((parcel) => (
                <tr key={parcel.id}>
                  <td>
                    <strong>{parcel.reference}</strong>
                    <small className="cell-subtext">
                      {
                        state.customers.find(
                          (customer) => customer.id === parcel.customerId,
                        )?.name
                      }
                    </small>
                  </td>
                  <td>
                    {
                      state.sellers.find(
                        (seller) => seller.id === parcel.sellerId,
                      )?.name
                    }
                  </td>
                  <td>{formatDate(parcel.receipt!.confirmedAt, true)}</td>
                  <td className="money-cell">{money(parcel.pricing.total)}</td>
                  <td className="money-cell">
                    {money(parcel.pricing.sellerShare)}
                  </td>
                  <td>
                    <Badge tone="green">+{money(parcel.pricing.fee)}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!receipts.length && (
            <p className="empty-inline">
              No confirmed receipts in this period.
            </p>
          )}
        </div>
        <div className="card-table-footer">
          <span>Retained rider fees in this period</span>
          <strong className="text-green">{money(summary.fees)}</strong>
        </div>
      </Card>
    </>
  );
}
