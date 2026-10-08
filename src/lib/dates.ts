import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  format,
  isValid,
  parse,
  startOfMonth,
} from "date-fns";
import { de, enUS, es, ptBR, type Locale } from "date-fns/locale";
import type { ISODate, Language } from "@/domain/types";

export const DATE_LOCALES: Record<Language, Locale> = {
  "pt-BR": ptBR,
  "en-US": enUS,
  "es-CO": es,
  "de-DE": de,
};

/** Parses a civil `yyyy-MM-dd` at local noon (immune to DST/time-zone day shifts). */
export function parseDate(value: ISODate): Date {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
}

export function toISODate(date: Date): ISODate {
  return format(date, "yyyy-MM-dd");
}

export function todayISO(): ISODate {
  return toISODate(new Date());
}

export function isValidISODate(value: string | null | undefined): value is ISODate {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return isValid(parse(value, "yyyy-MM-dd", new Date()));
}

/** `yyyy-MM` month key. */
export function monthKeyOf(date: ISODate | Date): string {
  return typeof date === "string" ? date.slice(0, 7) : format(date, "yyyy-MM");
}

export function currentMonthKey(): string {
  return monthKeyOf(new Date());
}

export function shiftMonthKey(monthKey: string, delta: number): string {
  return monthKeyOf(addMonths(parseDate(`${monthKey}-01`), delta));
}

export function monthBounds(monthKey: string): { start: ISODate; end: ISODate } {
  const d = parseDate(`${monthKey}-01`);
  return { start: toISODate(startOfMonth(d)), end: toISODate(endOfMonth(d)) };
}

export function addDaysISO(date: ISODate, days: number): ISODate {
  return toISODate(addDays(parseDate(date), days));
}

export function addMonthsISO(date: ISODate, months: number): ISODate {
  return toISODate(addMonths(parseDate(date), months));
}

export function daysBetween(from: ISODate, to: ISODate): number {
  return differenceInCalendarDays(parseDate(to), parseDate(from));
}

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/** dd/MM/yyyy */
export function formatDate(value: ISODate | null | undefined): string {
  if (!value) return "—";
  return format(parseDate(value), "dd/MM/yyyy");
}

/** dd/MM */
export function formatDayMonth(value: ISODate | null | undefined): string {
  if (!value) return "—";
  return format(parseDate(value), "dd/MM");
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return isValid(d) ? format(d, "dd/MM/yyyy HH:mm") : "—";
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Month in full, year omitted when it is the current year (releases-month pipe). */
export function monthLabel(monthKey: string, language: Language = "pt-BR"): string {
  const d = parseDate(`${monthKey}-01`);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return capitalize(format(d, sameYear ? "LLLL" : "LLLL yyyy", { locale: DATE_LOCALES[language] }));
}

export function monthShortLabel(monthKey: string, language: Language = "pt-BR"): string {
  return capitalize(format(parseDate(`${monthKey}-01`), "LLL", { locale: DATE_LOCALES[language] })).replace(".", "");
}

export function weekdayLabel(value: ISODate, language: Language = "pt-BR"): string {
  return capitalize(format(parseDate(value), "EEEE", { locale: DATE_LOCALES[language] }));
}

export function dayHeading(value: ISODate, language: Language = "pt-BR"): string {
  return capitalize(format(parseDate(value), "EEEE, d 'de' LLLL", { locale: DATE_LOCALES[language] }));
}

/** Converts `MM/yyyy` reference to a `yyyy-MM` key. */
export function referenceToMonthKey(reference: string): string {
  const [mm, yyyy] = reference.split("/");
  return `${yyyy}-${mm}`;
}
