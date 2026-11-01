"use client";

import { useSyncExternalStore } from "react";
import { initialState } from "./seed";
import type { PrototypeState } from "./types";

const STORAGE_KEY = "hatid-rider-prototype-v1";
let snapshot = initialState;
let loaded = false;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePrototypeHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => loaded,
    () => false,
  );
}

function emit() {
  listeners.forEach((listener) => listener());
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // The prototype remains usable in memory if browser storage is unavailable.
  }
}

export const prototypeStore = {
  hydrate() {
    if (loaded) return;
    loaded = true;
    try {
      const saved: unknown = JSON.parse(
        localStorage.getItem(STORAGE_KEY) ?? "null",
      );
      if (
        saved &&
        typeof saved === "object" &&
        "version" in saved &&
        saved.version === 1 &&
        "parcels" in saved &&
        Array.isArray(saved.parcels) &&
        "customers" in saved &&
        Array.isArray(saved.customers) &&
        "sellers" in saved &&
        Array.isArray(saved.sellers) &&
        "batches" in saved &&
        Array.isArray(saved.batches) &&
        "remittances" in saved &&
        Array.isArray(saved.remittances) &&
        "settings" in saved &&
        "activity" in saved
      ) {
        snapshot = saved as PrototypeState;
      }
    } catch {
      snapshot = initialState;
    }
    emit();
  },
  update(action: (state: PrototypeState) => PrototypeState) {
    const next = action(snapshot);
    snapshot =
      next === snapshot
        ? snapshot
        : {
            ...next,
            pendingChanges: next.offline
              ? next.pendingChanges + 1
              : next.pendingChanges,
          };
    persist();
    emit();
  },
  reset() {
    snapshot = structuredClone(initialState);
    persist();
    emit();
  },
};

export function usePrototypeState(): PrototypeState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => snapshot,
    () => initialState,
  );
}
