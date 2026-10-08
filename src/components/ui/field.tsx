import * as React from "react";
import { cn } from "@/lib/utils";

interface FieldProps {
  label: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: string;
  optional?: boolean;
  className?: string;
  children: React.ReactNode;
  /** Visually hide the label (still announced). */
  srLabel?: boolean;
  counter?: { value: number; max: number };
}

/** Label + control + hint/error, wired for assistive tech via ids passed by the caller. */
export function Field({ label, htmlFor, hint, error, optional, className, children, srLabel, counter }: FieldProps) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <div className={cn("flex items-baseline justify-between gap-2", srLabel && "sr-only")}>
        <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink-2">
          {label}
          {optional && <span className="ml-1 font-normal text-ink-3">(opcional)</span>}
        </label>
        {counter && (
          <span className={cn("text-xs tabular text-ink-3", counter.value > counter.max && "text-negative")} aria-hidden>
            {counter.value}/{counter.max}
          </span>
        )}
      </div>
      {children}
      {error ? (
        <p id={htmlFor ? `${htmlFor}-error` : undefined} role="alert" className="text-[13px] text-negative">
          {error}
        </p>
      ) : hint ? (
        <p id={htmlFor ? `${htmlFor}-hint` : undefined} className="text-[13px] leading-snug text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function describedBy(id: string, error?: unknown, hint?: unknown): string | undefined {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}
