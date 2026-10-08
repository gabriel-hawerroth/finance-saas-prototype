import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "relative inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-md)] text-sm font-medium transition-[background-color,color,box-shadow,transform] duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-fg shadow-[var(--shadow-soft)] hover:opacity-90",
        secondary: "border border-line-strong bg-surface text-ink hover:bg-surface-2",
        subtle: "bg-surface-2 text-ink hover:bg-surface-3",
        ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink",
        danger: "bg-negative text-white hover:opacity-90 dark:text-[#1a0c0a]",
        "danger-ghost": "text-negative hover:bg-negative-soft",
        brand: "bg-brand text-[#14160a] hover:brightness-95",
        link: "h-auto px-0 text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink",
      },
      size: {
        xs: "h-7 px-2.5 text-xs",
        sm: "h-8 px-3",
        md: "h-10 px-4",
        lg: "h-12 px-5 text-[15px]",
        icon: "size-10",
        "icon-sm": "size-8",
        "icon-xs": "size-7 [&_svg]:size-3.5",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, asChild = false, loading = false, disabled, children, type, ...props },
  ref,
) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      ref={ref}
      type={asChild ? undefined : (type ?? "button")}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={asChild ? undefined : disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading && <Loader2 className="animate-spin" aria-hidden />}
          {children}
        </>
      )}
    </Comp>
  );
});
