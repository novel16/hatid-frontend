"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { Pagination } from "@/components/pagination";
import { errorMessage, type PaginatedResponse } from "@/lib/api";

export interface SelectRecord {
  id: string | number;
  name: string;
}

/** Shares a keyboard-accessible searchable dropdown without fetching entire account directories. */
export function SearchSelect<T extends SelectRecord>({
  label,
  value,
  onChange,
  loadOptions,
  describe,
  required = false,
  hideLabel = false,
  clearLabel,
  floating = false,
}: {
  label: string;
  value: T | null;
  onChange: (record: T | null) => void;
  loadOptions: (
    query: string,
    page: number,
    signal: AbortSignal,
  ) => Promise<PaginatedResponse<T>>;
  describe?: (record: T) => string;
  required?: boolean;
  hideLabel?: boolean;
  clearLabel?: string;
  floating?: boolean;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState({ search: "", page: 1, revision: 0 });
  const [result, setResult] = useState<PaginatedResponse<T> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [active, setActive] = useState(0);
  const listId = `${id}-options`;

  /** Cancel obsolete searches and avoid requests while the dropdown is closed. */
  useEffect(() => {
    if (!open) return;
    let current = true;
    const controller = new AbortController();
    const timer = setTimeout(
      /** Retrieve one page and disregard results belonging to an earlier search. */ async () => {
        try {
          const response = await loadOptions(
            query.search,
            query.page,
            controller.signal,
          );
          if (!current) return;
          const lastPage = Math.max(1, response.meta.last_page);
          if (query.page > lastPage) {
            setQuery({ ...query, page: lastPage });
            return;
          }
          setResult(response);
          setActive(0);
          setLoading(false);
        } catch (cause) {
          if (current) {
            setError(errorMessage(cause));
            setLoading(false);
          }
        }
      },
      query.search ? 250 : 0,
    );
    /** Closing or changing a query prevents late network responses from replacing this list. */
    return () => {
      current = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, query, loadOptions]);

  /** Outside clicks dismiss the choices without changing the selected record. */
  useEffect(() => {
    if (!open) return;
    /** A click inside this select, including its pager, keeps it available. */
    function outside(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", outside);
    /** Remove the listener when the popup closes or unmounts. */
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  /** Keep keyboard choices visible by scrolling the existing parent, never a nested result list. */
  useEffect(() => {
    if (open && !loading)
      root.current
        ?.querySelector<HTMLElement>(".search-select-active")
        ?.scrollIntoView({ block: "nearest" });
  }, [active, open, loading]);

  /** Start each changed search/page/retry with an honest loading state. */
  function update(values: Partial<typeof query> = {}) {
    setLoading(true);
    setError("");
    setActive(0);
    setQuery(
      /** Preserve unaffected search state while allowing an explicit retry. */
      (current) => ({ ...current, ...values, revision: current.revision + 1 }),
    );
  }

  /** Focusing the selected label starts a fresh search without clearing the saved selection. */
  function show() {
    if (open) return;
    update({ search: "", page: 1 });
    setOpen(true);
  }

  /** Only an explicit choice changes the selected record. */
  function choose(record: T | null) {
    onChange(record);
    setOpen(false);
    input.current?.focus();
  }

  /** Keep Enter/Escape inside the dropdown and support arrows plus server-page navigation. */
  function keyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      input.current?.focus();
      return;
    }
    if (event.target !== input.current) return;
    if (event.key === "Enter") {
      event.preventDefault();
      if (open && !loading && !error && result?.data[active])
        choose(result.data[active]);
      return;
    }
    if (
      ["ArrowDown", "ArrowUp", "Home", "End", "PageDown", "PageUp"].includes(
        event.key,
      )
    ) {
      if (!open) {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          show();
        }
        return;
      }
      event.preventDefault();
      if (loading || error || !result) return;
      if (event.key === "PageDown" && query.page < result.meta.last_page)
        update({ page: query.page + 1 });
      else if (event.key === "PageUp" && query.page > 1)
        update({ page: query.page - 1 });
      else if (event.key === "Home") setActive(0);
      else if (event.key === "End")
        setActive(Math.max(0, result.data.length - 1));
      else if (event.key === "ArrowDown")
        setActive(Math.max(0, Math.min(active + 1, result.data.length - 1)));
      else if (event.key === "ArrowUp") setActive(Math.max(0, active - 1));
    }
  }

  return (
    <div
      ref={root}
      className={`field search-select ${floating ? "search-select-floating" : ""}`}
      onKeyDown={keyDown}
      onBlur={
        /** Leaving this control restores the selected label instead of accepting typed text. */ (
          event,
        ) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null))
            setOpen(false);
        }
      }
    >
      <span id={`${id}-label`} className={hideLabel ? "sr-only" : undefined}>
        {label}
        {required && <b className="required"> *</b>}
      </span>
      <div className="input-with-icon">
        <Search size={16} aria-hidden="true" />
        <input
          ref={input}
          role="combobox"
          aria-labelledby={`${id}-label`}
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-autocomplete="list"
          aria-required={required}
          aria-activedescendant={
            open && !loading && !error && result?.data[active]
              ? `${id}-${result.data[active].id}`
              : undefined
          }
          type="text"
          autoComplete="off"
          maxLength={100}
          placeholder={
            value
              ? value.name
              : (clearLabel ?? `Search ${label.toLocaleLowerCase()}…`)
          }
          value={open ? query.search : (value?.name ?? "")}
          onFocus={show}
          onChange={
            /** Typed text searches but never replaces a selected identity by itself. */ (
              event,
            ) => {
              update({ search: event.target.value, page: 1 });
              setOpen(true);
            }
          }
        />
        <button
          type="button"
          className="search-select-toggle"
          aria-label={`Toggle ${label.toLocaleLowerCase()} choices`}
          aria-expanded={open}
          tabIndex={-1}
          onMouseDown={
            /** Preserve the combobox focus when toggling its choices. */ (
              event,
            ) => event.preventDefault()
          }
          onClick={
            /** Open or close the available choices. */ () => {
              if (open) setOpen(false);
              else {
                show();
                input.current?.focus();
              }
            }
          }
        >
          <ChevronDown size={16} />
        </button>
      </div>
      {open && (
        <div className="search-select-panel">
          {clearLabel && (
            <button
              type="button"
              className="text-link search-select-clear"
              onClick={
                /** Return to an unfiltered/all-record selection explicitly. */ () =>
                  choose(null)
              }
            >
              {clearLabel}
            </button>
          )}
          {loading ? (
            <p className="search-select-message" role="status">
              Loading…
            </p>
          ) : error ? (
            <div className="search-select-message" role="alert">
              <p>{error}</p>
              <button
                type="button"
                className="text-link"
                onClick={/** Retry only on request. */ () => update()}
              >
                Try again
              </button>
            </div>
          ) : !result?.data.length ? (
            <p className="search-select-message" role="status">
              No matching {label.toLocaleLowerCase()}.
            </p>
          ) : null}
          <div
            id={listId}
            role="listbox"
            aria-labelledby={`${id}-label`}
            className="search-select-options"
          >
            {!loading &&
              !error &&
              result?.data.map(
                /** Each option retains its actual record identity and optional context. */ (
                  record,
                  index,
                ) => (
                  <button
                    key={record.id}
                    id={`${id}-${record.id}`}
                    type="button"
                    role="option"
                    tabIndex={-1}
                    aria-selected={value?.id === record.id}
                    className={
                      active === index ? "search-select-active" : undefined
                    }
                    onMouseDown={
                      /** Keep keyboard focus on the search field while choosing by pointer. */ (
                        event,
                      ) => event.preventDefault()
                    }
                    onMouseEnter={
                      /** Match the keyboard highlight to the option under the pointer. */ () =>
                        setActive(index)
                    }
                    onClick={
                      /** Confirm this record, rather than merely typed search text. */ () =>
                        choose(record)
                    }
                  >
                    <span>
                      <strong>{record.name}</strong>
                      {describe && <small>{describe(record)}</small>}
                    </span>
                    {value?.id === record.id && <Check size={16} />}
                  </button>
                ),
              )}
          </div>
          {result && !error && (
            <Pagination
              compact
              label={`${label} choices pagination`}
              page={result.meta.current_page}
              perPage={10}
              total={result.meta.total}
              disabled={loading}
              onChange={
                /** Move focus before disabling the pager, keeping the dropdown open while loading. */ (
                  next,
                ) => {
                  input.current?.focus();
                  update({ page: next.page });
                }
              }
            />
          )}
        </div>
      )}
    </div>
  );
}
