"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  getPageNumbers,
  getPagination,
  PAGE_SIZES,
  type PageSize,
  type PaginationState,
} from "@/lib/pagination";

interface PaginationEntriesProps {
  perPage: PageSize;
  onChange: (value: PaginationState) => void;
  disabled?: boolean;
  label?: string;
}

interface PaginationProps extends PaginationEntriesProps {
  page: number;
  total: number;
  compact?: boolean;
}

/** Shares the entry selector above each list while resetting changed sizes to page one. */
export function PaginationEntries({
  perPage,
  onChange,
  disabled = false,
  label = "List pagination",
}: PaginationEntriesProps) {
  return (
    <label className="pagination-entries">
      Show
      <select
        aria-label={label + " entries per page"}
        value={perPage}
        disabled={disabled}
        onChange={
          /** A larger or smaller page starts at the first result. */ (event) =>
            onChange({
              page: 1,
              perPage: Number(event.target.value) as PageSize,
            })
        }
      >
        {PAGE_SIZES.map(
          /** Keep entry choices identical on every list. */ (size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ),
        )}
      </select>
      entries
    </label>
  );
}

/** Shares full-list navigation and compact Prev/Page/Next navigation for modal pickers. */
export function Pagination({
  page,
  perPage,
  total,
  onChange,
  disabled = false,
  label = "List pagination",
  compact = false,
}: PaginationProps) {
  const current = getPagination({ page, perPage, total });

  /** Ignores duplicate requests while retaining the selected entry count. */
  function changePage(value: number) {
    if (disabled || value === current.page) return;
    onChange({ page: value, perPage });
  }

  return (
    <nav
      className={compact ? "pagination pagination-compact" : "pagination"}
      aria-label={label}
      aria-busy={disabled}
    >
      <div className="pagination-layout">
        {!compact && (
          <p className="pagination-summary" role="status" aria-live="polite">
            Showing {current.from.toLocaleString()}–
            {current.to.toLocaleString()} of {total.toLocaleString()}
          </p>
        )}
        {!compact && (
          <div className="pagination-desktop">
            <button
              type="button"
              aria-label="Previous page"
              disabled={disabled || current.page === 1}
              onClick={
                /** Move to the preceding result page. */ () =>
                  changePage(current.page - 1)
              }
            >
              <ChevronLeft size={16} />
            </button>
            {getPageNumbers(current.page, current.lastPage).map(
              /** Keep current/nearby pages reachable by mouse and keyboard. */ (
                value,
              ) =>
                typeof value === "number" ? (
                  <button
                    type="button"
                    key={value}
                    aria-label={"Page " + value}
                    aria-current={current.page === value ? "page" : undefined}
                    disabled={disabled}
                    onClick={
                      /** Request this numbered page. */ () => changePage(value)
                    }
                  >
                    {value}
                  </button>
                ) : (
                  <span
                    key={value}
                    className="pagination-ellipsis"
                    aria-hidden="true"
                  >
                    …
                  </span>
                ),
            )}
            <button
              type="button"
              aria-label="Next page"
              disabled={disabled || current.page === current.lastPage}
              onClick={
                /** Move to the following result page. */ () =>
                  changePage(current.page + 1)
              }
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
        <div className="pagination-mobile">
          <button
            type="button"
            aria-label="Previous page"
            disabled={disabled || current.page === 1}
            onClick={
              /** Move to the preceding result page. */ () =>
                changePage(current.page - 1)
            }
          >
            <ChevronLeft size={16} /> Prev
          </button>
          <span role="status" aria-live="polite">
            Page {current.page} of {current.lastPage}
          </span>
          <button
            type="button"
            aria-label="Next page"
            disabled={disabled || current.page === current.lastPage}
            onClick={
              /** Move to the following result page. */ () =>
                changePage(current.page + 1)
            }
          >
            Next <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </nav>
  );
}

/** Paginates already-loaded sample records; API callers pass their server state directly. */
export function usePagination<T>(items: readonly T[], resetKey = "") {
  const [selection, setSelection] = useState<
    PaginationState & { resetKey: string }
  >({
    page: 1,
    perPage: 10,
    resetKey,
  });
  const current = getPagination({
    page: selection.resetKey === resetKey ? selection.page : 1,
    perPage: selection.perPage,
    total: items.length,
  });

  // Adjust this component's state during render so a changed filter never shows an old page.
  if (selection.resetKey !== resetKey || selection.page !== current.page) {
    setSelection({ ...selection, resetKey, page: current.page });
  }

  /** Shares page/entry updates while preserving this list's current filter identity. */
  function change(value: PaginationState) {
    setSelection({ ...value, resetKey });
  }

  return {
    items: items.slice(current.from ? current.from - 1 : 0, current.to),
    controls: {
      page: current.page,
      perPage: current.perPage,
      total: current.total,
      onChange: change,
    },
  };
}
