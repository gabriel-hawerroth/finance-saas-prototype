"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Segmented } from "@/components/ui/segmented";
import { OptionPicker } from "@/components/ui/option-picker";
import { EChart, tooltipBase, type ChartTokens } from "@/components/charts/echart";
import { EmptyState, ErrorState } from "@/components/shared/content-state";
import { Money, useMoneyFormatter } from "@/components/shared/money";
import { PageHeader, Panel } from "@/components/shared/page-header";
import { api } from "@/data/api";
import { qk } from "@/data/query-keys";
import type { BalanceGrouper, Id } from "@/domain/types";
import { useInstitutions } from "@/features/institutions/queries";
import { useAccounts } from "@/features/picklists/queries";
import { accountPickerOptions } from "@/features/releases/options";
import { useIsDesktop } from "@/hooks/use-media-query";
import { formatDate, formatDayMonth, parseDate } from "@/lib/dates";
import { storage } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { ChartTypeToggle, DistributionPanel, seriesColor, type ChartType, type DistItem } from "./distribution";
import { defaultPeriod, PeriodPicker, toReportPeriod, type PeriodState } from "./period";

const TABS = [
  { href: "/relatorios/por-categoria", label: "Por categoria" },
  { href: "/relatorios/por-conta", label: "Por conta" },
  { href: "/relatorios/evolucao-saldo", label: "Evolução do saldo" },
];

function ReportsHeader() {
  const pathname = usePathname();
  return (
    <div className="grid gap-5">
      <PageHeader eyebrow="Análise" title="Relatórios" />
      <nav aria-label="Relatórios" className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
        {TABS.map((t) => {
          const active = pathname === t.href;
          return (
            <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined} className={cn("relative shrink-0 px-3 pb-3 pt-1 text-sm font-medium transition-colors", active ? "text-ink" : "text-ink-3 hover:text-ink")}>
              {t.label}
              {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-ink" />}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

interface ReportPrefs {
  period: PeriodState;
  chart: ChartType;
}

/** Report preferences saved per report on this device (cleared on logout). */
function useReportPrefs(key: string, defaultChart: ChartType) {
  const [prefs, setPrefs] = React.useState<ReportPrefs>(() => storage.get<ReportPrefs>(key, { period: defaultPeriod(), chart: defaultChart }));
  const update = (patch: Partial<ReportPrefs>) =>
    setPrefs((p) => {
      const next = { ...p, ...patch };
      storage.set(key, next);
      return next;
    });
  return [prefs, update] as const;
}

function SidePanels({ expenses, revenues }: { expenses: React.ReactNode; revenues: React.ReactNode }) {
  const isDesktop = useIsDesktop();
  const [side, setSide] = React.useState<"E" | "R">("E");
  if (isDesktop) return <div className="grid grid-cols-2 items-start gap-4">{[expenses, revenues]}</div>;
  return (
    <div className="grid gap-3">
      <Segmented
        label="Painel"
        stretch
        value={side}
        onValueChange={setSide}
        options={[
          { value: "E", label: "Despesas" },
          { value: "R", label: "Receitas" },
        ]}
      />
      {side === "E" ? expenses : revenues}
    </div>
  );
}

/* ───────── by category (R22 / R21) ───────── */

const HINT_KEY = "finax.report.drillHintSeen";

export function CategoryReportView() {
  const [prefs, update] = useReportPrefs("finax.report.category", "pie");
  const period = toReportPeriod(prefs.period);
  const q = useQuery({ queryKey: qk.reports.byCategory(period ?? { interval: "MONTHLY" }), queryFn: () => api.reports.byCategory(period!), enabled: period != null });
  const [drill, setDrill] = React.useState<{ side: "E" | "R"; id: Id; name: string; color: string } | null>(null);
  const [hintSeen, setHintSeen] = React.useState(() => storage.get(HINT_KEY, false));
  const subQ = useQuery({
    queryKey: qk.reports.bySub(drill?.id ?? 0, period ?? { interval: "MONTHLY" }),
    queryFn: () => api.reports.bySubcategory(drill!.id, period!),
    enabled: drill != null && period != null,
  });


  const toItems = (list: NonNullable<typeof q.data>["expenses"]): DistItem[] => list.map((i) => ({ key: String(i.category.id), name: i.category.name, value: i.value, percent: i.percent, color: i.category.color, icon: i.category.icon }));
  const subItems = (): DistItem[] =>
    (subQ.data ?? []).map((s, idx) => ({
      key: s.subcategoryName,
      name: s.subcategoryName === "principal" ? `${drill?.name} — geral` : s.subcategoryName,
      value: s.value,
      percent: s.percent,
      color: `${drill!.color}${Math.round(Math.max(0.35, 1 - idx * 0.13) * 255).toString(16).padStart(2, "0")}`,
    }));

  const select = (side: "E" | "R") => (item: DistItem) => {
    setDrill({ side, id: Number(item.key), name: item.name, color: item.color });
    if (!hintSeen) {
      setHintSeen(true);
      storage.set(HINT_KEY, true);
    }
  };

  const panel = (side: "E" | "R") => {
    const drilled = drill?.side === side;
    return (
      <DistributionPanel
        key={side}
        title={side === "E" ? "Despesas" : "Receitas"}
        tone={side === "E" ? "negative" : "positive"}
        chartType={prefs.chart}
        items={drilled ? subItems() : q.data ? toItems(side === "E" ? q.data.expenses : q.data.revenues) : undefined}
        isPending={drilled ? subQ.isPending : q.isPending || period == null}
        isError={drilled ? subQ.isError : q.isError}
        onRetry={() => (drilled ? subQ.refetch() : q.refetch())}
        retrying={q.isFetching}
        onSelect={drilled ? undefined : select(side)}
        drill={drilled ? { title: drill!.name, onBack: () => setDrill(null) } : undefined}
        showDrillHint={!hintSeen && !drilled}
      />
    );
  };

  return (
    <div className="grid gap-6">
      <ReportsHeader />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PeriodPicker
          idPrefix="rc"
          value={prefs.period}
          onChange={(p) => {
            setDrill(null);
            update({ period: p });
          }}
        />
        <ChartTypeToggle
          value={prefs.chart}
          onChange={(c) => {
            setDrill(null);
            update({ chart: c });
          }}
        />
      </div>
      <SidePanels expenses={panel("E")} revenues={panel("R")} />
    </div>
  );
}

/* ───────── by account (R23) ───────── */

export function AccountReportView() {
  const [prefs, update] = useReportPrefs("finax.report.account", "bar");
  const period = toReportPeriod(prefs.period);
  const q = useQuery({ queryKey: qk.reports.byAccount(period ?? { interval: "MONTHLY" }), queryFn: () => api.reports.byAccount(period!), enabled: period != null });
  const items = (list: NonNullable<typeof q.data>["expenses"]): DistItem[] => list.map((i, idx) => ({ key: i.accountName, name: i.accountName, value: i.value, percent: i.percent, color: seriesColor(idx) }));
  return (
    <div className="grid gap-6">
      <ReportsHeader />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PeriodPicker idPrefix="ra" value={prefs.period} onChange={(p) => update({ period: p })} />
        <ChartTypeToggle value={prefs.chart} onChange={(c) => update({ chart: c })} />
      </div>
      <SidePanels
        expenses={<DistributionPanel key="E" title="Despesas" tone="negative" chartType={prefs.chart} items={q.data ? items(q.data.expenses) : undefined} isPending={q.isPending || period == null} isError={q.isError} onRetry={() => q.refetch()} retrying={q.isFetching} />}
        revenues={<DistributionPanel key="R" title="Receitas" tone="positive" chartType={prefs.chart} items={q.data ? items(q.data.revenues) : undefined} isPending={q.isPending || period == null} isError={q.isError} onRetry={() => q.refetch()} retrying={q.isFetching} />}
      />
    </div>
  );
}

/* ───────── balance evolution (R24) ───────── */

const GROUPERS: { value: BalanceGrouper; label: string }[] = [
  { value: "DAILY", label: "Diário" },
  { value: "WEEKLY", label: "Semanal" },
  { value: "MONTHLY", label: "Mensal" },
  { value: "BY_RELEASE", label: "Por lançamento" },
];

export function BalanceEvolutionView() {
  const [state, setState] = React.useState<{ period: PeriodState; grouper: BalanceGrouper; account: string }>(() =>
    storage.get("finax.report.balance", { period: defaultPeriod(), grouper: "DAILY", account: "all" }),
  );
  const save = (patch: Partial<typeof state>) =>
    setState((s) => {
      const n = { ...s, ...patch };
      storage.set("finax.report.balance", n);
      return n;
    });
  const accountsQ = useAccounts();
  const { data: institutions = [] } = useInstitutions();
  const fmt = useMoneyFormatter();
  const period = toReportPeriod(state.period);
  const accountId = state.account === "all" ? null : Number(state.account.split("-")[1]);
  const accountName = state.account === "all" ? "Todas as contas" : accountsQ.data?.find((a) => a.id === accountId)?.displayName ?? "Conta";
  const q = useQuery({
    queryKey: qk.reports.balance(period ?? { interval: "MONTHLY" }, state.grouper, accountId),
    queryFn: () => api.reports.balanceEvolution(period!, state.grouper, accountId),
    enabled: period != null,
  });
  const points = React.useMemo(() => q.data ?? [], [q.data]);
  const first = points[0]?.amount ?? 0;
  const last = points[points.length - 1]?.amount ?? 0;

  const option = React.useCallback(
    (t: ChartTokens) => ({
      aria: { enabled: true },
      grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
      tooltip: {
        ...tooltipBase(t),
        trigger: "axis",
        axisPointer: { type: "line", lineStyle: { color: t.axis } },
        formatter: (ps: { dataIndex: number }[]) => {
          const p = points[ps[0].dataIndex];
          return `${formatDate(p.date)}<br/><b>${fmt(p.amount)}</b>`;
        },
      },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: points.map((p) => formatDayMonth(p.date)),
        axisLabel: { color: t.ink3, fontSize: 11, hideOverlap: true },
        axisLine: { lineStyle: { color: t.axis } },
        axisTick: { show: false },
      },
      yAxis: {
        type: "value",
        scale: true,
        axisLabel: { color: t.ink3, fontSize: 11, formatter: (v: number) => (fmt(v).includes("•") ? "•••" : Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)) },
        splitLine: { lineStyle: { color: t.grid } },
      },
      series: [
        {
          type: "line",
          name: accountName,
          data: points.map((p) => p.amount),
          smooth: 0.25,
          showSymbol: points.length < 40,
          symbolSize: 8,
          lineStyle: { width: 2, color: t.ink },
          itemStyle: { color: t.ink, borderColor: t.surface, borderWidth: 2 },
          areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: `${t.brand}66` }, { offset: 1, color: `${t.brand}00` }] } },
        },
      ],
    }),
    [points, fmt, accountName],
  );

  return (
    <div className="grid gap-6">
      <ReportsHeader />
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full sm:w-64">
          <OptionPicker
            aria-labelledby="be-acc-label"
            value={state.account}
            onValueChange={(v) => save({ account: v })}
            disabled={!accountsQ.isSuccess}
            groups={[{ options: [{ value: "all", label: "Todas as contas" }] }, { label: "Contas", options: accountPickerOptions(accountsQ.data ?? [], institutions) }]}
          />
          <span id="be-acc-label" className="sr-only">
            Conta
          </span>
        </div>
        <PeriodPicker idPrefix="rb" value={state.period} onChange={(p) => save({ period: p })} />
        <Segmented label="Agrupamento" value={state.grouper} onValueChange={(g) => save({ grouper: g })} options={GROUPERS} />
      </div>
      <Panel className="p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-ink-3">{accountName}</p>
            <p className="font-display text-4xl">
              <Money value={last} />
            </p>
          </div>
          {points.length > 1 && (
            <p className="text-sm text-ink-3">
              Variação no período <Money value={last - first} signed tone="auto" className="font-medium" />
            </p>
          )}
        </div>
        {q.isPending || period == null ? (
          <div className="skeleton h-72" />
        ) : q.isError ? (
          <ErrorState onRetry={() => q.refetch()} retrying={q.isFetching} />
        ) : points.length === 0 ? (
          <EmptyState title="Sem dados no período" />
        ) : (
          <EChart option={option} height={320} label={`Evolução do saldo de ${accountName}: de ${fmt(first)} em ${formatDate(points[0].date)} para ${fmt(last)} em ${formatDate(points[points.length - 1].date)}`} />
        )}
        {points.length > 0 && <p className="sr-only">Último ponto em {parseDate(points[points.length - 1].date).toLocaleDateString("pt-BR")}</p>}
      </Panel>
    </div>
  );
}
