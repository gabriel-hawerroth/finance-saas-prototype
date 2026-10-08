import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Rounds to cents, avoiding binary float drift. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function sum<T>(items: readonly T[], pick: (item: T) => number): number {
  return round2(items.reduce((acc, item) => acc + pick(item), 0));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
