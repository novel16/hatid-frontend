export const PAGE_SIZES = [10, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];
export interface PaginationState {
  page: number;
  perPage: PageSize;
}

/** Bounds the visible range after filtering, deletion or a page-size change. */
export function getPagination({
  page,
  perPage,
  total,
}: PaginationState & { total: number }) {
  const lastPage = Math.max(1, Math.ceil(total / perPage));
  const currentPage = Math.max(1, Math.min(page, lastPage));
  return {
    page: currentPage,
    perPage,
    total,
    lastPage,
    from: total ? (currentPage - 1) * perPage + 1 : 0,
    to: Math.min(currentPage * perPage, total),
  };
}

/** Shows nearby pages and direct boundary links without rendering a long number list. */
export function getPageNumbers(
  page: number,
  lastPage: number,
): (number | "before" | "after")[] {
  if (lastPage <= 5) {
    // Small lists do not need ellipses.
    return Array.from({ length: lastPage }, (_, index) => index + 1);
  }
  const candidates = [...new Set([1, page - 1, page, page + 1, lastPage])]
    // Keep boundary neighbors inside the available pages.
    .filter((value) => value >= 1 && value <= lastPage)
    // Maintain numeric navigation order.
    .sort((left, right) => left - right);
  const pages: (number | "before" | "after")[] = [];
  let previous = 0;
  for (const value of candidates) {
    if (previous && value - previous === 2) pages.push(previous + 1);
    else if (previous && value - previous > 2)
      pages.push(value <= page ? "before" : "after");
    pages.push(value);
    previous = value;
  }
  return pages;
}
