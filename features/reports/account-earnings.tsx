"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  CheckCheck,
  RefreshCw,
  Search,
  Wallet,
} from "lucide-react";
import { useActions } from "@/components/providers";
import {
  Badge,
  Button,
  Card,
  downloadFile,
  EmptyState,
  Field,
  LinkButton,
  PageHeading,
} from "@/components/ui";
import { Pagination, PaginationEntries } from "@/components/pagination";
import {
  errorMessage,
  reportPath,
  validationMessage,
  type EarningsPage,
  type ReportFilters,
  type ReportPeriod,
} from "@/lib/api";
import { formatDate, money } from "@/lib/prototype/domain";

const receiptDate = new Intl.DateTimeFormat("en-PH", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Manila",
});

/** Owns actual report filters, complete period totals, paginated receipts and authenticated CSV exports. */
export function AccountEarnings() {
  const { request, notify } = useActions();
  const [filters, setFilters] = useState<ReportFilters & { revision: number }>({
    period: "week",
    query: "",
    method: "all",
    page: 1,
    perPage: 10,
    revision: 0,
  });
  const [draft, setDraft] = useState<
    Partial<Pick<ReportFilters, "period" | "date" | "start" | "end">>
  >({});
  const [result, setResult] = useState<EarningsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [metric, setMetric] = useState<"fees" | "receipts">("fees");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const read = useRef(0);
  const mounted = useRef(true);
  const download = useRef<AbortController | null>(null);

  /** Navigating away or changing accounts cancels a private pending download before it reaches the browser. */
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      download.current?.abort();
    };
  }, []);

  /** Hide stale money immediately and preserve unaffected dates/search on page changes or retries. */
  function update(values: Partial<ReportFilters> = {}) {
    read.current++;
    setLoading(true);
    setError("");
    setExportError("");
    setFilters(
      /** A revision permits refreshing the same applied filters. */ (
        current,
      ) => ({ ...current, ...values, revision: current.revision + 1 }),
    );
  }

  /** Only the latest account/filter result can update rows, whole-period totals and the trend. */
  useEffect(() => {
    let active = true;
    const attempt = ++read.current;
    const controller = new AbortController();
    const timer = setTimeout(
      /** Search uses one debounced private page, never a full client-side ledger. */ async () => {
        try {
          const response = await request<EarningsPage>(
            reportPath(filters),
            "GET",
            undefined,
            { signal: controller.signal },
          );
          if (!active || attempt !== read.current) return;
          const last = Math.max(1, response.meta.last_page);
          if (filters.page > last) {
            update({ page: last });
            return;
          }
          setResult(response);
          setLoading(false);
        } catch (cause) {
          if (active && attempt === read.current) {
            setError(validationMessage(cause));
            setLoading(false);
          }
        }
      },
      filters.query ? 250 : 0,
    );
    /** Superseded reads cannot replace the current report or revive another account's rows. */
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [request, filters]);

  /** Date edits stay local until Apply, so half-entered native dates never start report requests. */
  function editDates(values: typeof draft) {
    setDraft(
      /** Preserve the other date inputs while the user edits a range. */ (
        current,
      ) => ({ ...current, ...values }),
    );
  }

  /** Apply one explicit calendar selection, clear incompatible fields and return to the first page. */
  function applyDates(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const period = String(data.get("period")) as ReportPeriod;
    update({
      period,
      date: period === "custom" ? undefined : String(data.get("date")),
      start: period === "custom" ? String(data.get("start")) : undefined,
      end: period === "custom" ? String(data.get("end")) : undefined,
      page: 1,
    });
    setDraft({});
  }

  /** Pin the visible resolved dates so an export still matches the report across a midnight/week boundary. */
  async function exportReport() {
    if (!result || loading || error || exporting || Object.keys(draft).length)
      return;
    const attempt = read.current;
    const controller = new AbortController();
    download.current = controller;
    setExporting(true);
    setExportError("");
    const period = result.report.period;
    try {
      const file = await request<Blob>(
        reportPath(
          {
            ...filters,
            period: "custom",
            date: undefined,
            start: period.start,
            end: period.end,
          },
          true,
        ),
        "GET",
        undefined,
        { responseType: "csv", signal: controller.signal },
      );
      if (!mounted.current || attempt !== read.current) return;
      downloadFile(file, `hatid-earnings-${period.start}-to-${period.end}.csv`);
      notify("Complete filtered earnings report downloaded.");
    } catch (cause) {
      if (mounted.current)
        setExportError(
          errorMessage(cause, "Unable to download this report. Try again."),
        );
    } finally {
      if (mounted.current) setExporting(false);
      if (download.current === controller) download.current = null;
    }
  }

  const report = !loading && !error ? result?.report : undefined;
  const calendar = result?.report.period;
  const chosenPeriod = draft.period ?? filters.period;
  const chosenStart = draft.start ?? filters.start ?? calendar?.start ?? "";
  const datesDirty = Object.keys(draft).length > 0;
  const controls = {
    page: result?.meta.current_page ?? filters.page,
    perPage: filters.perPage,
    total: result?.meta.total ?? 0,
    disabled: loading || exporting,
    onChange: update,
  };
  const highest = Math.max(
    1,
    ...(report?.trend.map(
      /** Both chart modes use actual numeric values from the same report. */ (
        bucket,
      ) => bucket[metric],
    ) ?? []),
  );
  const labelEvery = Math.max(1, Math.ceil((report?.trend.length ?? 0) / 8));

  return (
    <>
      <PageHeading
        eyebrow="EVERY SUCCESSFUL HANDOVER COUNTS"
        title="Your work, your earnings."
        description="Actual retained fees and confirmed receipts, recognized by payment date in Asia/Manila."
      >
        <Button
          disabled={!result || loading || !!error || exporting || datesDirty}
          onClick={exportReport}
        >
          <ArrowDownToLine size={16} />
          {exporting ? "Preparing report…" : "Download CSV"}
        </Button>
      </PageHeading>
      {exportError && (
        <p className="form-error" role="alert">
          {exportError}
        </p>
      )}
      <Card>
        <form className="report-date-form" onSubmit={applyDates}>
          <fieldset
            className="report-date-fields form-fieldset"
            disabled={exporting}
          >
            <Field label="Report period">
              <select
                name="period"
                value={chosenPeriod}
                onChange={
                  /** Calendar presets use an explicit anchor date; custom uses its two bounds. */ (
                    event,
                  ) => editDates({ period: event.target.value as ReportPeriod })
                }
              >
                <option value="day">Daily</option>
                <option value="week">Weekly</option>
                <option value="month">Monthly</option>
                <option value="custom">Custom dates</option>
              </select>
            </Field>
            {chosenPeriod === "custom" ? (
              <>
                <Field label="From" required>
                  <input
                    type="date"
                    name="start"
                    value={chosenStart}
                    required
                    onChange={
                      /** Keep the exact chosen start for validation and redisplay. */ (
                        event,
                      ) => editDates({ start: event.target.value })
                    }
                  />
                </Field>
                <Field label="Through" required>
                  <input
                    type="date"
                    name="end"
                    min={chosenStart || undefined}
                    value={draft.end ?? filters.end ?? calendar?.end ?? ""}
                    required
                    onChange={
                      /** The final local calendar day is included in the report. */ (
                        event,
                      ) => editDates({ end: event.target.value })
                    }
                  />
                </Field>
              </>
            ) : (
              <Field
                label={
                  chosenPeriod === "week"
                    ? "Date in the week"
                    : chosenPeriod === "month"
                      ? "Date in the month"
                      : "Date"
                }
                required
              >
                <input
                  type="date"
                  name="date"
                  value={
                    draft.date ??
                    filters.date ??
                    calendar?.anchor ??
                    calendar?.start ??
                    ""
                  }
                  required
                  onChange={
                    /** Changing a calendar anchor waits for Apply rather than fetching on each keystroke. */ (
                      event,
                    ) => editDates({ date: event.target.value })
                  }
                />
              </Field>
            )}
            <Button type="submit">Apply dates</Button>
          </fieldset>
          {datesDirty && (
            <p className="text-muted">
              Apply dates to update the report and enable CSV export.
            </p>
          )}
        </form>
      </Card>
      <p className="text-muted">
        {report
          ? `${report.period.start} – ${report.period.end} · ${report.period.timezone}`
          : loading
            ? "Loading the selected period…"
            : "The selected report is unavailable. Your filter inputs are preserved."}
      </p>
      <div className="metrics">
        {[
          {
            label: "Retained rider earnings",
            value: report ? money(report.summary.fees) : "—",
            detail: "Fees earned at confirmed delivery",
            icon: ArrowUpRight,
            tone: "sage",
          },
          {
            label: "Successful parcels",
            value: report?.summary.receipts ?? "—",
            detail: "Full payments confirmed in this period",
            icon: CheckCheck,
            tone: "blue",
          },
          {
            label: "Recorded COD cash",
            value: report ? money(report.summary.cash) : "—",
            detail: "Actual cash receipts",
            icon: Wallet,
            tone: "peach",
          },
          {
            label: "Recorded GCash",
            value: report ? money(report.summary.gcash) : "—",
            detail: "Manually confirmed by the rider",
            icon: Wallet,
            tone: "purple",
          },
        ].map(
          /** Empty/loading states never masquerade as zero earnings or sample money. */ ({
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
      {report && (
        <Card
          title={
            metric === "fees" ? "Retained delivery fees" : "Confirmed parcels"
          }
          description={`${report.period.start} – ${report.period.end} · ${report.bucket_days === 1 ? "daily totals" : `${report.bucket_days}-day totals`}`}
          action={
            <div className="segmented segmented-small">
              <button
                className={metric === "fees" ? "selected" : ""}
                aria-pressed={metric === "fees"}
                onClick={
                  /** Switch only the display metric, keeping the applied report intact. */ () =>
                    setMetric("fees")
                }
              >
                Earnings
              </button>
              <button
                className={metric === "receipts" ? "selected" : ""}
                aria-pressed={metric === "receipts"}
                onClick={
                  /** Counts represent fully received parcels rather than pending work. */ () =>
                    setMetric("receipts")
                }
              >
                Parcels
              </button>
            </div>
          }
        >
          <div
            className="earnings-chart account-report-chart"
            aria-label="Trend for the selected report period"
          >
            <div className="chart-gridlines" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </div>
            {report.trend.map(
              /** Zero receipts draw zero-height bars; each interval remains available to assistive text. */ (
                bucket,
                index,
              ) => (
                <div className="chart-column" key={bucket.start}>
                  {report.trend.length <= 14 && (
                    <span className="chart-value">
                      {metric === "fees" ? money(bucket.fees) : bucket.receipts}
                    </span>
                  )}
                  <span
                    role="img"
                    aria-label={`${bucket.start} to ${bucket.end}: ${metric === "fees" ? money(bucket.fees) : `${bucket.receipts} parcels`}`}
                    className={`chart-bar ${bucket[metric] === highest ? "chart-bar-highlight" : ""}`}
                    style={{ height: `${(bucket[metric] / highest) * 100}%` }}
                    title={`${bucket.start} – ${bucket.end}: ${metric === "fees" ? money(bucket.fees) : `${bucket.receipts} parcels`}`}
                  />
                  {index % labelEvery === 0 && (
                    <span className="chart-day">
                      {formatDate(bucket.start)}
                    </span>
                  )}
                </div>
              ),
            )}
          </div>
          <div className="chart-footer">
            <span>Original batch dates stay unchanged.</span>
            <Badge tone="green">Fees counted once</Badge>
          </div>
        </Card>
      )}
      <Card
        title="Your earnings ledger"
        description="Every matching confirmed receipt contributes to period totals and CSV, across all pages."
      >
        <div className="table-toolbar">
          <div className="toolbar-filters">
            <select
              aria-label="Report payment method"
              value={filters.method}
              disabled={exporting}
              onChange={
                /** Filter by actual recorded receipt method and start at the first page. */ (
                  event,
                ) =>
                  update({
                    method: event.target.value as ReportFilters["method"],
                    page: 1,
                  })
              }
            >
              <option value="all">All actual payment methods</option>
              <option value="cash">COD cash</option>
              <option value="gcash">GCash · rider confirmed</option>
            </select>
            <Button
              variant="ghost"
              disabled={loading || exporting}
              onClick={
                /** Reload the same applied report without changing date drafts. */ () =>
                  update()
              }
            >
              <RefreshCw size={16} /> Refresh
            </Button>
          </div>
        </div>
        <div className="table-toolbar">
          <PaginationEntries {...controls} label="Earnings ledger pagination" />
          <div className="input-with-icon">
            <Search size={17} />
            <input
              type="search"
              maxLength={100}
              disabled={exporting}
              value={filters.query}
              aria-label="Search earnings ledger"
              placeholder="Customer, seller or parcel…"
              onChange={
                /** Search all matching private receipts rather than filtering only this page. */ (
                  event,
                ) => update({ query: event.target.value, page: 1 })
              }
            />
          </div>
        </div>
        {loading ? (
          <div className="card-body">
            <p role="status">Loading your report…</p>
          </div>
        ) : error ? (
          <div className="card-body form-stack">
            <p className="form-error" role="alert">
              {error}
            </p>
            <Button
              variant="secondary"
              onClick={
                /** Retry after connectivity/validation errors while retaining the requested inputs. */ () =>
                  update()
              }
            >
              Try again
            </Button>
          </div>
        ) : result && !result.data.length ? (
          <EmptyState title="No confirmed receipts in this period">
            Try another date range or search. Pending, held and failed parcels
            do not earn a retained fee.
          </EmptyState>
        ) : (
          result && (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Parcel / customer</th>
                    <th>Original intake</th>
                    <th>Seller</th>
                    <th>Confirmed payment</th>
                    <th>Received</th>
                    <th>Seller share</th>
                    <th>Rider earnings</th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.map(
                    /** Saved receipt/pricing data is never recomputed from today's seller defaults. */ (
                      parcel,
                    ) => (
                      <tr key={parcel.id}>
                        <td>
                          <LinkButton
                            variant="ghost"
                            href={`/deliveries/${parcel.id}`}
                          >
                            {parcel.reference}
                          </LinkButton>
                          <small>{parcel.customer.name}</small>
                        </td>
                        <td
                          title={`${parcel.batch.start} – ${parcel.batch.end}`}
                        >
                          {parcel.batch.name}
                        </td>
                        <td>{parcel.seller.name}</td>
                        <td>
                          {receiptDate.format(
                            new Date(parcel.receipt.confirmed_at),
                          )}
                          <small>
                            {parcel.receipt.method === "cash"
                              ? "COD cash"
                              : "GCash · rider confirmed"}
                          </small>
                        </td>
                        <td>{money(parcel.receipt.amount)}</td>
                        <td>{money(parcel.pricing.sellerShare)}</td>
                        <td>
                          <Badge tone="green">
                            {money(parcel.pricing.fee)}
                          </Badge>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          )
        )}
        {result && !loading && !error && (
          <>
            <Pagination {...controls} label="Earnings ledger pagination" />
            <div className="card-table-footer">
              <span>Retained fees for the complete filtered period</span>
              <strong className="text-green">
                {money(result.report.summary.fees)}
              </strong>
            </div>
          </>
        )}
      </Card>
    </>
  );
}
