import { daysBetween } from "@/lib/dates";
import type { CycleSimulationInvoice } from "./types";

/** Days from close to due, wrapping the month; same day = 0 (C8). */
export function closeToDueGap(closeDay: number, dueDay: number): number {
  if (dueDay === closeDay) return 0;
  return dueDay > closeDay ? dueDay - closeDay : dueDay + 30 - closeDay;
}

/** Unusual gap warning: outside 1–15 days (C8). Never blocks. */
export function isUnusualGap(closeDay: number, dueDay: number): boolean {
  const gap = closeToDueGap(closeDay, dueDay);
  return gap < 1 || gap > 15;
}

/** Suggested close day = due − 7, wrapping the month, capped at 28 (C9). e.g. due 3 → 27; due 5 → 28. */
export function suggestCloseDay(dueDay: number): number {
  const raw = dueDay - 7;
  const wrapped = raw >= 1 ? raw : raw + 31;
  return Math.min(wrapped, 28);
}

/** Cycle length outside 15–45 days is atypical (C10). */
export function isAtypicalCycle(days: number): boolean {
  return days < 15 || days > 45;
}

/** A transition cycle longer than 31 days skips a month without invoice (C10). */
export function skipsMonth(invoice: Pick<CycleSimulationInvoice, "transition" | "days">): boolean {
  return invoice.transition && invoice.days > 31;
}

export function cycleDays(firstDay: string, closeDay: string): number {
  return daysBetween(firstDay, closeDay) + 1;
}
