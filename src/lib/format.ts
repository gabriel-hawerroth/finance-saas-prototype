import type { CurrencySymbol, InvoiceOption, Language } from "@/domain/types";
import { formatDayMonth, monthLabel, referenceToMonthKey } from "./dates";

export const HIDDEN_VALUE = "•••";

const numberFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** `1.234,56` — always comma decimal / dot thousands (custom-currency pipe). */
export function formatNumber(value: number): string {
  return numberFormatter.format(Math.abs(value) < 0.005 ? 0 : value);
}

export interface MoneyOptions {
  currency?: CurrencySymbol;
  hidden?: boolean;
  /** Force a leading sign: "+" for positives too. */
  signed?: boolean;
}

export function formatMoney(value: number, { currency = "R$", hidden = false, signed = false }: MoneyOptions = {}): string {
  if (hidden) return `${currency} ${HIDDEN_VALUE}`;
  const abs = formatNumber(Math.abs(value));
  const sign = value < -0.004 ? "−" : signed && value > 0.004 ? "+" : "";
  return `${sign}${currency} ${abs}`;
}

export function formatPercent(value: number, digits = 1): string {
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: digits })}%`;
}

/** Invoice name: month in full (+year if not current) and "· fecha dd/MM" when ambiguous (§5.20). */
export function invoiceLabel(
  invoice: Pick<InvoiceOption, "referenceMonth" | "sharesReferenceMonth" | "closeDay">,
  language: Language = "pt-BR",
): string {
  const base = monthLabel(referenceToMonthKey(invoice.referenceMonth), language);
  return invoice.sharesReferenceMonth ? `${base} · fecha ${formatDayMonth(invoice.closeDay)}` : base;
}

export function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}
