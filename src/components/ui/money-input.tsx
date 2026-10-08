"use client";
import * as React from "react";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { inputClass } from "./input";

interface MoneyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "size"> {
  value: number;
  onValueChange: (value: number) => void;
  currency?: string;
  allowNegative?: boolean;
  size?: "md" | "lg" | "hero";
}

/**
 * Currency field that types from the cents up ("1" → 0,01 → "12" → 0,12…), the way
 * banking apps do. Paste-friendly; "-" toggles the sign when negatives are allowed.
 */
export const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(function MoneyInput(
  { value, onValueChange, currency = "R$", allowNegative, size = "md", className, onKeyDown, ...props },
  ref,
) {
  const negative = value < 0;
  const display = `${negative ? "−" : ""}${formatNumber(Math.abs(value))}`;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const digits = raw.replace(/\D/g, "").slice(0, 13);
    const cents = digits ? parseInt(digits, 10) : 0;
    const next = cents / 100;
    onValueChange(allowNegative && negative && next !== 0 ? -next : next);
  };

  return (
    <div className={cn("relative", className)}>
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3",
          size === "hero" ? "text-xl" : size === "lg" ? "text-base" : "text-sm",
        )}
      >
        {currency}
      </span>
      <input
        ref={ref}
        type="text"
        inputMode={allowNegative ? "text" : "numeric"}
        autoComplete="off"
        value={display}
        onChange={handleChange}
        onKeyDown={(e) => {
          if (allowNegative && (e.key === "-" || e.key === "Subtract")) {
            e.preventDefault();
            if (value !== 0) onValueChange(-value);
          }
          onKeyDown?.(e);
        }}
        className={cn(
          inputClass,
          "tabular text-right",
          size === "hero" && "h-16 pl-12 font-display text-4xl sm:text-4xl",
          size === "lg" && "h-12 pl-11 text-lg sm:text-lg",
          size === "md" && "pl-10",
          allowNegative && "pr-12",
        )}
        {...props}
      />
      {allowNegative && (
        <button
          type="button"
          onClick={() => value !== 0 && onValueChange(-value)}
          className="absolute right-1.5 top-1/2 grid h-7 -translate-y-1/2 place-items-center rounded-[var(--radius-sm)] bg-surface-2 px-2 text-xs font-medium text-ink-2 hover:bg-surface-3"
          aria-label={negative ? "Tornar positivo" : "Tornar negativo"}
        >
          ±
        </button>
      )}
    </div>
  );
});
