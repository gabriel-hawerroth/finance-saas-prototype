"use client";
import { Money } from "@/components/shared/money";
import type { MonthTotals, TotalPair } from "@/domain/cash-flow";
import { cn } from "@/lib/utils";

function Indicator({ label, pair, tone, dot }: { label: string; pair: TotalPair; tone: "positive" | "negative" | "auto"; dot: string }) {
  const ratio = pair.forecast !== 0 ? Math.max(0, Math.min(1, pair.done / pair.forecast)) : pair.done !== 0 ? 1 : 0;
  return (
    <div className="min-w-0 px-3 py-3 sm:px-5 sm:py-3.5">
      <p className="flex items-center gap-2 text-xs text-ink-3 sm:text-[13px]">
        <span className={cn("size-2 rounded-full", dot)} aria-hidden />
        {label}
      </p>
      <p className="mt-1.5 text-[15px] font-semibold tracking-tight sm:text-2xl">
        <Money value={pair.done} tone={tone === "auto" ? "auto" : "neutral"} />
      </p>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-3" aria-hidden>
        <div className={cn("h-full rounded-full", tone === "positive" ? "bg-positive" : tone === "negative" ? "bg-negative" : "bg-ink")} style={{ width: `${ratio * 100}%` }} />
      </div>
      <p className="mt-1.5 text-[11px] text-ink-3 sm:text-xs">
        Previsto <Money value={pair.forecast} className="block font-medium text-ink-2 sm:inline" />
      </p>
    </div>
  );
}

/** Month totals (C1): realized vs. forecast for revenues, expenses and balance. */
export function TotalsStrip({ totals, filtered }: { totals: MonthTotals; filtered: boolean }) {
  return (
    <section aria-label="Totais do mês" className="rounded-[var(--radius-xl)] border border-line bg-surface">
      <div className="grid grid-cols-3 divide-x divide-line">
        <Indicator label="Receitas" pair={totals.revenues} tone="positive" dot="bg-positive" />
        <Indicator label="Despesas" pair={totals.expenses} tone="negative" dot="bg-negative" />
        <Indicator label="Balanço" pair={totals.balance} tone="auto" dot="bg-ink" />
      </div>
      {filtered && <p className="border-t border-line px-5 py-2 text-xs text-ink-3">Totais calculados sobre os lançamentos filtrados.</p>}
    </section>
  );
}
