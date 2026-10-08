import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const badgeVariants = cva("inline-flex items-center gap-1 whitespace-nowrap rounded-full font-medium [&_svg]:size-3", {
  variants: {
    tone: {
      neutral: "bg-surface-2 text-ink-2",
      positive: "bg-positive-soft text-positive",
      negative: "bg-negative-soft text-negative",
      warning: "bg-warning-soft text-warning",
      transfer: "bg-transfer-soft text-transfer",
      brand: "bg-brand-soft text-brand-ink",
      outline: "border border-line-strong text-ink-2",
    },
    size: {
      sm: "h-5 px-1.5 text-[11px]",
      md: "h-6 px-2 text-xs",
    },
  },
  defaultVariants: { tone: "neutral", size: "sm" },
});

export function Badge({ className, tone, size, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone, size }), className)} {...props} />;
}
