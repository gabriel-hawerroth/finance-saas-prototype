"use client";
import { create } from "zustand";
import type { Id } from "@/domain/types";

interface ReleaseContext {
  /** Month the visible screen is focused on (cash flow), used for the default date. */
  monthKey?: string;
  accountId?: Id;
  cardId?: Id;
  set: (ctx: Omit<ReleaseContext, "set">) => void;
}

/** What the visible screen suggests for a new release (§4.10, §4.15). */
export const useReleaseContext = create<ReleaseContext>((set) => ({
  set: (ctx) => set({ monthKey: ctx.monthKey, accountId: ctx.accountId, cardId: ctx.cardId }),
}));
