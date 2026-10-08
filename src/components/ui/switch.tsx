"use client";
import * as React from "react";
import { Switch as S } from "radix-ui";
import { cn } from "@/lib/utils";

export const Switch = React.forwardRef<React.ComponentRef<typeof S.Root>, React.ComponentPropsWithoutRef<typeof S.Root>>(function Switch({ className, ...props }, ref) {
  return (
    <S.Root
      ref={ref}
      className={cn(
        "peer inline-flex h-6 w-10 shrink-0 items-center rounded-full border border-transparent bg-line-strong p-0.5 transition-colors data-[state=checked]:bg-primary disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <S.Thumb className="block size-5 rounded-full bg-surface shadow-sm transition-transform data-[state=checked]:translate-x-4 dark:data-[state=checked]:bg-primary-fg" />
    </S.Root>
  );
});

interface SwitchRowProps {
  id: string;
  label: React.ReactNode;
  hint?: React.ReactNode;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
}

/** A full-width toggle row: label + description on the left, switch on the right. */
export function SwitchRow({ id, label, hint, checked, onCheckedChange, disabled }: SwitchRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div className="grid gap-0.5">
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </label>
        {hint && (
          <p id={`${id}-hint`} className="text-[13px] leading-snug text-ink-3">
            {hint}
          </p>
        )}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} aria-describedby={hint ? `${id}-hint` : undefined} />
    </div>
  );
}
