"use client";
import * as React from "react";
import { ToggleGroup } from "radix-ui";
import { cn } from "@/lib/utils";

interface SegmentedProps<T extends string> {
  value: T;
  onValueChange: (value: T) => void;
  options: { value: T; label: React.ReactNode; icon?: React.ReactNode; disabled?: boolean }[];
  label: string;
  size?: "sm" | "md";
  className?: string;
  stretch?: boolean;
}

/** Single-choice pill control (radio semantics via Radix ToggleGroup). */
export function Segmented<T extends string>({ value, onValueChange, options, label, size = "md", className, stretch }: SegmentedProps<T>) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(v) => v && onValueChange(v as T)}
      aria-label={label}
      className={cn("inline-flex rounded-[var(--radius-md)] bg-surface-2 p-0.5", stretch && "flex w-full", className)}
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          disabled={o.disabled}
          className={cn(
            "inline-flex items-center justify-center gap-1.5 rounded-[calc(var(--radius-md)-2px)] font-medium text-ink-3 transition-colors hover:text-ink data-[state=on]:bg-surface data-[state=on]:text-ink data-[state=on]:shadow-[var(--shadow-soft)] disabled:opacity-40 [&_svg]:size-4",
            size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-[13px]",
            stretch && "flex-1",
          )}
        >
          {o.icon}
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
