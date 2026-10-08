"use client";
import * as React from "react";
import type { MonthlyRelease } from "@/domain/types";

/**
 * Local realized/pending overrides layered on top of server data while a toggle is in
 * flight. Overrides are tied to the data snapshot they were made on, so fresh server
 * data automatically supersedes them.
 */
export function useDoneOverrides(data: MonthlyRelease[] | undefined) {
  const [state, setState] = React.useState<{ base: MonthlyRelease[] | undefined; map: Record<string, boolean> }>({ base: undefined, map: {} });
  const patch = React.useCallback(
    (key: string, done: boolean) => setState((s) => ({ base: data, map: { ...(s.base === data ? s.map : {}), [key]: done } })),
    [data],
  );
  const merged = React.useMemo(() => {
    const map = state.base === data ? state.map : {};
    return data?.map((r) => (r.key in map ? { ...r, done: map[r.key] } : r));
  }, [data, state]);
  return { merged, patch };
}
