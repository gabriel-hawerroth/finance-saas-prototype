"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { HomeInterval, UserConfigs } from "@/domain/types";

export const DEFAULT_CONFIGS: UserConfigs = { theme: "system", language: "pt-BR", currency: "R$", showAuditFields: true };

interface PrefsState extends UserConfigs {
  /** Global "hide values" toggle (§5.11). */
  showValues: boolean;
  sidebarCollapsed: boolean;
  categoriesView: "grid" | "list";
  homeSpendsInterval: HomeInterval;
  homeEssentialInterval: HomeInterval;
  setConfigs: (patch: Partial<UserConfigs>) => void;
  set: (patch: Partial<Omit<PrefsState, "set" | "setConfigs">>) => void;
}

/** Device-local preferences. User configs are mirrored here and synced with the API. */
export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      ...DEFAULT_CONFIGS,
      showValues: true,
      sidebarCollapsed: false,
      categoriesView: "grid",
      homeSpendsInterval: "LAST_30_DAYS",
      homeEssentialInterval: "LAST_30_DAYS",
      setConfigs: (patch) => set(patch),
      set: (patch) => set(patch),
    }),
    { name: "finax.prefs" },
  ),
);

export function pickConfigs(s: UserConfigs): UserConfigs {
  return { theme: s.theme, language: s.language, currency: s.currency, showAuditFields: s.showAuditFields };
}
