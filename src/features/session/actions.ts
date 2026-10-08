"use client";
import type { QueryClient } from "@tanstack/react-query";
import { api } from "@/data/api";
import { qk } from "@/data/query-keys";
import type { User } from "@/domain/types";
import { storage, SESSION_KEYS } from "@/lib/storage";
import { usePrefs, pickConfigs } from "@/features/prefs/store";
import { useSession } from "./store";

/** Post-login (§4.2): keep the user, fetch configs (apply theme/lang) and photo. */
export async function completeLogin(qc: QueryClient, user: User): Promise<void> {
  useSession.getState().setUser(user);
  storage.remove("finax.resend.activation");
  storage.remove("finax.resend.recovery");
  try {
    const configs = await api.user.configs();
    usePrefs.getState().setConfigs(pickConfigs(configs));
    qc.setQueryData(qk.configs, configs);
  } catch {
    /* keep local prefs */
  }
  qc.removeQueries({ queryKey: ["fin"] });
}

/** Ends the session and clears session-scoped local data (F4). */
export async function endSession(qc: QueryClient, { callApi = true }: { callApi?: boolean } = {}): Promise<void> {
  if (callApi) {
    try {
      await api.auth.logout();
    } catch {
      /* ignore */
    }
  }
  useSession.getState().setUser(null);
  for (const k of SESSION_KEYS) storage.remove(k);
  qc.clear();
}
