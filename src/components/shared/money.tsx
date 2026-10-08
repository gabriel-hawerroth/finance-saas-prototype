"use client";
import { usePrefs } from "@/features/prefs/store";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

interface MoneyProps {
  value: number;
  /** Prefix "+" on positives. */
  signed?: boolean;
  /** Colour by sign: positive = green, negative = red. */
  tone?: "auto" | "positive" | "negative" | "neutral" | "muted";
  className?: string;
  /** Show only the absolute value. */
  abs?: boolean;
}

/** Money value honouring the currency preference and the global "hide values" toggle. */
export function Money({ value, signed, tone = "neutral", className, abs }: MoneyProps) {
  const currency = usePrefs((s) => s.currency);
  const hidden = !usePrefs((s) => s.showValues);
  const v = abs ? Math.abs(value) : value;
  const toneClass =
    tone === "auto"
      ? v > 0.004
        ? "text-positive"
        : v < -0.004
          ? "text-negative"
          : "text-ink"
      : tone === "positive"
        ? "text-positive"
        : tone === "negative"
          ? "text-negative"
          : tone === "muted"
            ? "text-ink-3"
            : "";
  return (
    <span className={cn("tabular whitespace-nowrap", toneClass, className)}>
      {hidden ? (
        <>
          <span aria-hidden>{formatMoney(v, { currency, hidden: true })}</span>
          <span className="sr-only">valor oculto</span>
        </>
      ) : (
        formatMoney(v, { currency, signed })
      )}
    </span>
  );
}

/** Plain-string formatter bound to preferences (for chart tooltips, aria labels…). */
export function useMoneyFormatter() {
  const currency = usePrefs((s) => s.currency);
  const hidden = !usePrefs((s) => s.showValues);
  return (value: number, signed = false) => formatMoney(value, { currency, hidden, signed });
}
