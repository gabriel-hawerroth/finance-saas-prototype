"use client";
import * as React from "react";
import { Checkbox as C } from "radix-ui";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export const Checkbox = React.forwardRef<React.ComponentRef<typeof C.Root>, React.ComponentPropsWithoutRef<typeof C.Root>>(function Checkbox({ className, ...props }, ref) {
  return (
    <C.Root
      ref={ref}
      className={cn(
        "grid size-[18px] shrink-0 place-items-center rounded-[5px] border border-line-strong bg-surface text-primary-fg transition-colors data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <C.Indicator>
        {props.checked === "indeterminate" ? <Minus className="size-3.5" strokeWidth={3} /> : <Check className="size-3.5" strokeWidth={3} />}
      </C.Indicator>
    </C.Root>
  );
});
