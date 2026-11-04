import assert from "node:assert/strict";
import test from "node:test";
import { getPageNumbers, getPagination } from "./pagination.ts";

/** A middle page exposes only its own ten-entry range and the full result count. */
test("ten entries keep the full total and calculate the visible range", () => {
  assert.deepEqual(getPagination({ page: 3, perPage: 10, total: 128 }), {
    page: 3,
    perPage: 10,
    total: 128,
    lastPage: 13,
    from: 21,
    to: 30,
  });
});

/** The end of a large page never invents entries beyond the actual total. */
test("one hundred entries end at the final partial page", () => {
  assert.deepEqual(getPagination({ page: 2, perPage: 100, total: 105 }), {
    page: 2,
    perPage: 100,
    total: 105,
    lastPage: 2,
    from: 101,
    to: 105,
  });
});

/** Deleting or filtering records keeps the selected page inside the remaining list. */
test("fifty entries clamp a page after the result set shrinks", () => {
  assert.deepEqual(getPagination({ page: 9, perPage: 50, total: 56 }), {
    page: 2,
    perPage: 50,
    total: 56,
    lastPage: 2,
    from: 51,
    to: 56,
  });
});

/** Empty search results have no fake first record or available next page. */
test("empty results show zero to zero on the first page", () => {
  assert.deepEqual(getPagination({ page: 4, perPage: 10, total: 0 }), {
    page: 1,
    perPage: 10,
    total: 0,
    lastPage: 1,
    from: 0,
    to: 0,
  });
});

/** A small list exposes every page without distracting ellipses. */
test("short pagination includes all pages", () => {
  assert.deepEqual(getPageNumbers(2, 3), [1, 2, 3]);
  assert.deepEqual(getPageNumbers(1, 1), [1]);
});

/** Long lists keep direct access to the boundaries and nearby pages. */
test("long pagination includes first, last and current neighbors", () => {
  assert.deepEqual(getPageNumbers(7, 13), [1, "before", 6, 7, 8, "after", 13]);
  assert.deepEqual(getPageNumbers(1, 13), [1, 2, "after", 13]);
  assert.deepEqual(getPageNumbers(13, 13), [1, "before", 12, 13]);
});
