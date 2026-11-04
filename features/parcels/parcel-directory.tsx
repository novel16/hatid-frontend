"use client";

import { useCallback } from "react";
import { useActions } from "@/components/providers";
import { SearchSelect } from "@/components/search-select";
import type {
  ApiBatch,
  ApiCustomer,
  ApiSeller,
  PaginatedResponse,
} from "@/lib/api";
import { money } from "@/lib/prototype/domain";
import type { Batch, Customer, Seller } from "@/lib/prototype/types";

export type DirectoryRecord = ApiCustomer | ApiSeller | ApiBatch;
export type DirectoryKind = "customer" | "seller" | "batch";

/** Explains actual directory records without inventing location or fee information. */
export function directoryDescription(
  record: DirectoryRecord | Batch | Customer | Seller,
): string {
  if ("addresses" in record) {
    const address = record.addresses.find(
      /** Archived destinations are not offered for new intake. */ (entry) =>
        !("archived_at" in entry) || !entry.archived_at,
    );
    return `${record.phone ?? "No phone"} · ${address?.text ?? "Address not provided"}`;
  }
  if ("fee" in record) return `Fee ${record.mode} · ${money(record.fee)}`;
  return `${record.start} – ${record.end}`;
}

/** Supplies the shared dropdown with private, debounced ten-record API pages. */
export function ParcelDirectorySelect({
  kind,
  value,
  onSelect,
  required = false,
  hideLabel = false,
  clearLabel,
  floating = false,
}: {
  kind: DirectoryKind;
  value: DirectoryRecord | null;
  onSelect: (record: DirectoryRecord | null) => void;
  required?: boolean;
  hideLabel?: boolean;
  clearLabel?: string;
  floating?: boolean;
}) {
  const { request } = useActions();
  const load = useCallback(
    /** Keep keys, ownership and pagination on the existing authenticated API. */
    (query: string, page: number, signal: AbortSignal) => {
      const params = new URLSearchParams({
        q: query,
        page: String(page),
        per_page: "10",
      });
      const endpoint = kind === "batch" ? "batches" : `${kind}s`;
      return request<PaginatedResponse<DirectoryRecord>>(
        `/${endpoint}?${params}`,
        "GET",
        undefined,
        { signal },
      );
    },
    [kind, request],
  );
  return (
    <SearchSelect
      label={
        kind === "batch"
          ? "Weekly batch"
          : kind === "customer"
            ? "Customer"
            : "Seller"
      }
      value={value}
      onChange={onSelect}
      loadOptions={load}
      describe={directoryDescription}
      required={required}
      hideLabel={hideLabel}
      clearLabel={clearLabel}
      floating={floating}
    />
  );
}
