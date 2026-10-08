import { currentMonthKey, monthKeyOf, todayISO } from "@/lib/dates";
import { FIXED_BY_OPTIONS } from "./constants";
import type { FixedBy, ISODate, RepeatMode } from "./types";

export const FIXED_REPEAT_LIMITS = { min: 2, max: 365 } as const;
export const INSTALLMENT_LIMITS = { min: 2, max: 199 } as const;

/** C12 — default date for a new release: today in the current month, else day 1 of the focused month. */
export function defaultReleaseDate(focusedMonthKey: string | undefined, today: ISODate = todayISO()): ISODate {
  if (!focusedMonthKey || focusedMonthKey === monthKeyOf(today) || focusedMonthKey === currentMonthKey()) return today;
  return `${focusedMonthKey}-01`;
}

/** C12 — default "done": installments → done; otherwise done when date ≤ today. */
export function defaultDone(date: ISODate, repeat: RepeatMode | null | undefined, today: ISODate = todayISO()): boolean {
  if (repeat === "INSTALLMENTS") return true;
  return date <= today;
}

/** C13 — suggested repetition count per periodicity. */
export function suggestedRepeatCount(fixedBy: FixedBy): number {
  return FIXED_BY_OPTIONS.find((o) => o.value === fixedBy)?.suggested ?? 12;
}

/** Installments: 1 becomes 2 when leaving the field; clamp 2–199. */
export function normalizeInstallments(value: number): number {
  if (!Number.isFinite(value) || value < INSTALLMENT_LIMITS.min) return INSTALLMENT_LIMITS.min;
  return Math.min(INSTALLMENT_LIMITS.max, Math.floor(value));
}
