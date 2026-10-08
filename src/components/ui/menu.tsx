"use client";
import * as React from "react";
import { DropdownMenu, Popover as P, Tooltip as T } from "radix-ui";
import { cn } from "@/lib/utils";

export const Menu = DropdownMenu.Root;
export const MenuTrigger = DropdownMenu.Trigger;

export function MenuContent({ className, align = "end", ...props }: React.ComponentPropsWithoutRef<typeof DropdownMenu.Content>) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align={align}
        sideOffset={6}
        className={cn("z-[60] min-w-48 rounded-[var(--radius-lg)] border border-line bg-surface p-1 shadow-[var(--shadow-lift)] data-[state=open]:animate-[fade-in_120ms_ease-out]", className)}
        {...props}
      />
    </DropdownMenu.Portal>
  );
}

export function MenuItem({ className, tone, ...props }: React.ComponentPropsWithoutRef<typeof DropdownMenu.Item> & { tone?: "danger" }) {
  return (
    <DropdownMenu.Item
      className={cn(
        "flex min-h-9 cursor-pointer select-none items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 text-sm text-ink outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[highlighted]:bg-surface-2 [&_svg]:size-4 [&_svg]:text-ink-3",
        tone === "danger" && "text-negative [&_svg]:text-negative",
        className,
      )}
      {...props}
    />
  );
}

export function MenuSeparator() {
  return <DropdownMenu.Separator className="my-1 h-px bg-line" />;
}

export function MenuLabel({ children }: { children: React.ReactNode }) {
  return <DropdownMenu.Label className="px-2.5 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-3">{children}</DropdownMenu.Label>;
}

export const Popover = P.Root;
export const PopoverTrigger = P.Trigger;
export const PopoverAnchor = P.Anchor;
export function PopoverContent({ className, align = "start", ...props }: React.ComponentPropsWithoutRef<typeof P.Content>) {
  return (
    <P.Portal>
      <P.Content
        align={align}
        sideOffset={6}
        className={cn("z-[60] rounded-[var(--radius-lg)] border border-line bg-surface shadow-[var(--shadow-lift)] outline-none data-[state=open]:animate-[fade-in_120ms_ease-out]", className)}
        {...props}
      />
    </P.Portal>
  );
}

export const TooltipProvider = T.Provider;

/** Short hint on hover/focus. Never the only place information lives. */
export function Tooltip({ content, children, side = "top" }: { content: React.ReactNode; children: React.ReactElement; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <T.Root delayDuration={250}>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content side={side} sideOffset={6} className="z-[70] max-w-64 rounded-[var(--radius-sm)] bg-ink px-2.5 py-1.5 text-xs leading-snug text-bg shadow-[var(--shadow-lift)]">
          {content}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
