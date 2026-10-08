"use client";
import * as React from "react";
import { Dialog } from "radix-ui";
import { Drawer } from "vaul";
import { X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Visually hide the description (still read by screen readers). */
  hideDescription?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  /** Desktop presentation: centred dialog or right-side sheet. */
  variant?: "center" | "side";
  /** Element rendered left of the title (icon, avatar…). */
  leading?: React.ReactNode;
  headerActions?: React.ReactNode;
  className?: string;
  /** Prevent closing on outside click (e.g. dirty forms). */
  dismissible?: boolean;
}

const SIZES = { sm: "max-w-[420px]", md: "max-w-[520px]", lg: "max-w-[640px]", xl: "max-w-[860px]" };

/**
 * Adaptive modal: a bottom drawer on phones (thumb reach, swipe to dismiss) and a
 * dialog or side sheet on larger screens. Both are fully keyboard/AT accessible.
 */
export function Modal({ open, onOpenChange, title, description, hideDescription, children, footer, size = "md", variant = "center", leading, headerActions, className, dismissible = true }: ModalProps) {
  const isMobile = useIsMobile();

  const header = (Title: typeof Dialog.Title, Desc: typeof Dialog.Description) => (
    <div className="flex items-start gap-3 px-5 pt-5 pb-3 sm:px-6">
      {leading}
      <div className="min-w-0 flex-1">
        <Title className="font-display text-[26px] leading-[1.1] text-ink">{title}</Title>
        {description ? (
          <Desc className={cn("mt-1 text-sm text-ink-3", hideDescription && "sr-only")}>{description}</Desc>
        ) : (
          <Desc className="sr-only">{typeof title === "string" ? title : ""}</Desc>
        )}
      </div>
      {headerActions}
      {!isMobile && (
        <Dialog.Close className="-mr-2 -mt-1 grid size-9 place-items-center rounded-full text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink" aria-label="Fechar">
          <X className="size-[18px]" />
        </Dialog.Close>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <Drawer.Root open={open} onOpenChange={onOpenChange} dismissible={dismissible} repositionInputs={false}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-[var(--overlay)]" />
          <Drawer.Content
            className={cn("fixed inset-x-0 bottom-0 z-50 flex max-h-[94dvh] flex-col rounded-t-[var(--radius-2xl)] border-t border-line bg-surface outline-none", className)}
          >
            <div aria-hidden className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-line-strong" />
            {header(Drawer.Title as unknown as typeof Dialog.Title, Drawer.Description as unknown as typeof Dialog.Description)}
            <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-5 pb-4">{children}</div>
            {footer && <div className="pb-safe border-t border-line bg-surface px-5 py-3">{footer}</div>}
            {!footer && <div className="pb-safe" />}
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    );
  }

  const side = variant === "side";
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[var(--overlay)] backdrop-blur-[2px] data-[state=open]:animate-[fade-in_160ms_ease-out]" />
        <Dialog.Content
          onPointerDownOutside={(e) => !dismissible && e.preventDefault()}
          onInteractOutside={(e) => !dismissible && e.preventDefault()}
          className={cn(
            "fixed z-50 flex flex-col border border-line bg-surface shadow-[var(--shadow-lift)] outline-none",
            side
              ? "inset-y-2 right-2 w-[calc(100%-1rem)] rounded-[var(--radius-xl)] data-[state=open]:animate-[slide-in_220ms_cubic-bezier(.2,.8,.2,1)]"
              : "left-1/2 top-1/2 max-h-[min(88vh,860px)] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-xl)] data-[state=open]:animate-[pop-in_180ms_cubic-bezier(.2,.8,.2,1)]",
            SIZES[size],
            className,
          )}
        >
          {header(Dialog.Title, Dialog.Description)}
          <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-6 pb-5">{children}</div>
          {footer && <div className="rounded-b-[var(--radius-xl)] border-t border-line bg-surface px-6 py-3.5">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Right-aligned action row for modal footers (stacks full-width on phones). */
export function ModalActions({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end [&>button]:w-full sm:[&>button]:w-auto", className)}>{children}</div>;
}
