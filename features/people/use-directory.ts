"use client";

import { useEffect, useState } from "react";
import { useActions } from "@/components/providers";
import {
  directoryPath,
  errorMessage,
  type ApiPage,
  type DirectoryFilters,
  type DirectoryKind,
} from "@/lib/api";

export interface DirectoryList<T> extends DirectoryFilters {
  items: T[];
  meta: ApiPage<T>["meta"] | null;
  loading: boolean;
  error: string;
  search: (value: string) => void;
  filterArchived: (value: boolean) => void;
  changePage: (value: number) => void;
  reload: (resetFilters?: boolean) => void;
}

/** Shares bounded server search/pagination while keeping account records out of demo storage. */
export function useDirectory<T>(kind: DirectoryKind): DirectoryList<T> {
  const { request } = useActions();
  const [query, setQuery] = useState("");
  const [archived, setArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<ApiPage<T> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Cancel stale UI updates when the query, account/session or mounted screen changes.
  useEffect(() => {
    let current = true;
    const timer = setTimeout(
      // Fetch after the search debounce and ignore superseded responses.
      async () => {
        setLoading(true);
        setError("");
        try {
          const response = await request<ApiPage<T>>(
            directoryPath(kind, { query, archived, page }),
          );
          if (current) setResult(response);
        } catch (cause) {
          if (current)
            setError(errorMessage(cause, "Unable to load this directory."));
        } finally {
          if (current) setLoading(false);
        }
      },
      query ? 250 : 0,
    );
    // An old response must not overwrite a newer search or a signed-out screen.
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [kind, query, archived, page, revision, request]);

  /** Starts a fresh page when the user searches. */
  function search(value: string) {
    setLoading(true);
    setQuery(value);
    setPage(1);
  }

  /** Keeps active and archived records in separate listings. */
  function filterArchived(value: boolean) {
    setLoading(true);
    setArchived(value);
    setPage(1);
  }

  /** Moves between bounded pages without allowing a negative page index. */
  function changePage(value: number) {
    setLoading(true);
    setPage(Math.max(1, value));
  }

  /** Refreshes mutations/retries, showing the active unfiltered list after a new record. */
  function reload(resetFilters = false) {
    setLoading(true);
    setPage(1);
    if (resetFilters) {
      setQuery("");
      setArchived(false);
    }
    // Trigger a reload even when the current filters did not change.
    setRevision((value) => value + 1);
  }

  return {
    items: result?.data ?? [],
    meta: result?.meta ?? null,
    query,
    archived,
    page,
    loading,
    error,
    search,
    filterArchived,
    changePage,
    reload,
  };
}
