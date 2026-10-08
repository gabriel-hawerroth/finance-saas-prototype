"use client";
import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { ReportInterval, ReportPeriod } from "@/domain/types";
import { usePrefs } from "@/features/prefs/store";
import { currentMonthKey, monthBounds, monthLabel, shiftMonthKey } from "@/lib/dates";

export interface PeriodState {
  interval: ReportInterval;
  month: string; // yyyy-MM
  year: number;
  start: string;
  end: string;
}

export function defaultPeriod(): PeriodState {
  const m = currentMonthKey();
  const { start, end } = monthBounds(m);
  return { interval: "MONTHLY", month: m, year: Number(m.slice(0, 4)), start, end };
}

export function toReportPeriod(p: PeriodState): ReportPeriod | null {
  switch (p.interval) {
    case "LAST_30_DAYS":
    case "LAST_12_MONTHS":
      return { interval: p.interval };
    case "MONTHLY": {
      const b = monthBounds(p.month);
      return { interval: "MONTHLY", initialDate: b.start, finalDate: b.end };
    }
    case "YEARLY":
      return { interval: "YEARLY", initialDate: `${p.year}-01-01`, finalDate: `${p.year}-12-31` };
    case "CUSTOM":
      if (!p.start || !p.end || p.start > p.end) return null;
      return { interval: "CUSTOM", initialDate: p.start, finalDate: p.end };
  }
}

const INTERVALS: { value: ReportInterval; label: string }[] = [
  { value: "LAST_30_DAYS", label: "Últimos 30 dias" },
  { value: "LAST_12_MONTHS", label: "Últimos 12 meses" },
  { value: "MONTHLY", label: "Mensal" },
  { value: "YEARLY", label: "Anual" },
  { value: "CUSTOM", label: "Personalizado" },
];

/** Interval + navigation (month/year) or custom range (§4.17). */
export function PeriodPicker({ value, onChange, idPrefix }: { value: PeriodState; onChange: (p: PeriodState) => void; idPrefix: string }) {
  const language = usePrefs((s) => s.language);
  const invalidCustom = value.interval === "CUSTOM" && (!value.start || !value.end || value.start > value.end);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select id={`${idPrefix}-interval`} aria-label="Intervalo" className="w-48" value={value.interval} onValueChange={(v) => onChange({ ...value, interval: v as ReportInterval })} options={INTERVALS} />
      {value.interval === "MONTHLY" && (
        <div className="flex items-center gap-1 rounded-[var(--radius-md)] border border-line-strong bg-surface px-1">
          <Button variant="ghost" size="icon-xs" aria-label="Mês anterior" onClick={() => onChange({ ...value, month: shiftMonthKey(value.month, -1) })}>
            <ChevronLeft />
          </Button>
          <span className="min-w-28 text-center text-sm font-medium" aria-live="polite">
            {monthLabel(value.month, language)}
          </span>
          <Button variant="ghost" size="icon-xs" aria-label="Próximo mês" onClick={() => onChange({ ...value, month: shiftMonthKey(value.month, 1) })}>
            <ChevronRight />
          </Button>
        </div>
      )}
      {value.interval === "YEARLY" && (
        <div className="flex items-center gap-1 rounded-[var(--radius-md)] border border-line-strong bg-surface px-1">
          <Button variant="ghost" size="icon-xs" aria-label="Ano anterior" onClick={() => onChange({ ...value, year: value.year - 1 })}>
            <ChevronLeft />
          </Button>
          <span className="min-w-14 text-center text-sm font-medium tabular" aria-live="polite">
            {value.year}
          </span>
          <Button variant="ghost" size="icon-xs" aria-label="Próximo ano" onClick={() => onChange({ ...value, year: value.year + 1 })}>
            <ChevronRight />
          </Button>
        </div>
      )}
      {value.interval === "CUSTOM" && (
        <div className="flex flex-wrap items-center gap-2">
          <Input type="date" aria-label="Data inicial" className="w-40" value={value.start} onChange={(e) => onChange({ ...value, start: e.target.value })} aria-invalid={invalidCustom || undefined} />
          <span className="text-sm text-ink-3">até</span>
          <Input type="date" aria-label="Data final" className="w-40" value={value.end} onChange={(e) => onChange({ ...value, end: e.target.value })} aria-invalid={invalidCustom || undefined} />
          {invalidCustom && (
            <p role="alert" className="w-full text-[13px] text-negative">
              Informe as duas datas, com o início antes do fim.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
