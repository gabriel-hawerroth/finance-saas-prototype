"use client";
import * as React from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
  compact?: boolean;
}

export function ErrorState({ title = "Não foi possível carregar", message = "Verifique sua conexão e tente novamente.", onRetry, retrying, className, compact }: ErrorStateProps) {
  return (
    <div role="alert" className={cn("flex flex-col items-center justify-center gap-3 text-center", compact ? "py-6" : "py-14", className)}>
      <span className="grid size-10 place-items-center rounded-full bg-negative-soft text-negative">
        <AlertTriangle className="size-5" aria-hidden />
      </span>
      <div>
        <p className="font-medium text-ink">{title}</p>
        <p className="mt-0.5 text-sm text-ink-3">{message}</p>
      </div>
      {onRetry && (
        <Button size="sm" onClick={onRetry} loading={retrying}>
          {!retrying && <RotateCw aria-hidden />}
          Tentar novamente
        </Button>
      )}
    </div>
  );
}

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  message?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}

export function EmptyState({ icon, title, message, action, className, compact }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 text-center", compact ? "py-6" : "py-14", className)}>
      {icon && <span className="grid size-12 place-items-center rounded-2xl bg-surface-2 text-ink-3 [&_svg]:size-6">{icon}</span>}
      <div className="max-w-sm">
        <p className="font-medium text-ink">{title}</p>
        {message && <p className="mt-1 text-sm text-ink-3">{message}</p>}
      </div>
      {action}
    </div>
  );
}

export function ListSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("grid gap-3", className)} aria-busy="true" aria-label="Carregando">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="skeleton size-10 rounded-[11px]" />
          <div className="grid flex-1 gap-1.5">
            <div className="skeleton h-3.5 w-1/2" />
            <div className="skeleton h-3 w-1/3" />
          </div>
          <div className="skeleton h-4 w-20" />
        </div>
      ))}
    </div>
  );
}
