"use client";
import { useSyncExternalStore } from "react";

/** True only after client hydration (persisted stores are available). */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}
