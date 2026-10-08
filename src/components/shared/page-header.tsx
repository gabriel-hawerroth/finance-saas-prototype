import * as React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, eyebrow, description, actions, className }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-3", className)}>
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-ink-3">{eyebrow}</p>}
        <h1 className="font-display text-[34px] leading-none text-ink sm:text-[42px]">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm text-ink-3">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Content surface: hairline border, soft radius. Used sparingly — sections, not every item. */
export function Panel({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return <section className={cn("rounded-[var(--radius-xl)] border border-line bg-surface", className)} {...props} />;
}

export function PanelHeader({ title, actions, description, className, as: Tag = "h2" }: { title: React.ReactNode; actions?: React.ReactNode; description?: React.ReactNode; className?: string; as?: "h2" | "h3" }) {
  return (
    <div className={cn("flex items-start justify-between gap-3 px-5 pt-4 pb-2", className)}>
      <div className="min-w-0">
        <Tag className="text-[15px] font-semibold text-ink">{title}</Tag>
        {description && <p className="mt-0.5 text-[13px] text-ink-3">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </div>
  );
}
