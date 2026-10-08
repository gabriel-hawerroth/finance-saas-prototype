"use client";
import * as React from "react";
import { ArrowLeft, ChartBar, ChartPie, List, MousePointerClick } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { EChart, tooltipBase, type ChartTokens } from "@/components/charts/echart";
import { CategoryIcon } from "@/components/shared/category-icon";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/shared/content-state";
import { Money, useMoneyFormatter } from "@/components/shared/money";
import { Panel, PanelHeader } from "@/components/shared/page-header";
import { cn } from "@/lib/utils";

export type ChartType = "pie" | "bar" | "list";

export interface DistItem {
  key: string;
  name: string;
  value: number;
  percent: number;
  color: string;
  icon?: string;
  drillable?: boolean;
}

/** Validated categorical palette (fixed order, folded into "Outros" past 7) for non-category series. */
const SERIES_LIGHT = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#8d8a80"];
const SERIES_DARK = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#2a9a2a", "#9085e9", "#7d7b74"];

export function seriesColor(index: number): string {
  const dark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  const palette = dark ? SERIES_DARK : SERIES_LIGHT;
  return palette[Math.min(index, palette.length - 1)];
}

/** Folds the tail of a list into "Outros" so no more than 8 identities are coloured. */
export function foldOthers(items: DistItem[], max = 8): DistItem[] {
  if (items.length <= max) return items;
  const head = items.slice(0, max - 1);
  const tail = items.slice(max - 1);
  return [...head, { key: "others", name: `Outros (${tail.length})`, value: tail.reduce((s, i) => s + i.value, 0), percent: tail.reduce((s, i) => s + i.percent, 0), color: "#8d8a80" }];
}

export function ChartTypeToggle({ value, onChange }: { value: ChartType; onChange: (v: ChartType) => void }) {
  return (
    <Segmented
      label="Tipo de visualização"
      value={value}
      onValueChange={onChange}
      options={[
        { value: "pie", label: <span className="sr-only sm:not-sr-only">Pizza</span>, icon: <ChartPie aria-hidden /> },
        { value: "bar", label: <span className="sr-only sm:not-sr-only">Barras</span>, icon: <ChartBar aria-hidden /> },
        { value: "list", label: <span className="sr-only sm:not-sr-only">Lista</span>, icon: <List aria-hidden /> },
      ]}
    />
  );
}

interface DistributionPanelProps {
  title: string;
  items: DistItem[] | undefined;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  retrying?: boolean;
  chartType: ChartType;
  onSelect?: (item: DistItem) => void;
  drill?: { title: string; onBack: () => void };
  showDrillHint?: boolean;
  tone: "negative" | "positive";
  className?: string;
}

export function DistributionPanel({ title, items, isPending, isError, onRetry, retrying, chartType, onSelect, drill, showDrillHint, tone, className }: DistributionPanelProps) {
  const fmt = useMoneyFormatter();
  const list = React.useMemo(() => [...(items ?? [])].sort((a, b) => b.value - a.value), [items]);
  const total = list.reduce((s, i) => s + i.value, 0);
  const shown = chartType === "list" ? list : foldOthers(list);

  const pieOption = React.useCallback(
    (t: ChartTokens) => ({
      aria: { enabled: true },
      tooltip: { ...tooltipBase(t), trigger: "item", formatter: (p: { name: string; value: number; percent: number }) => `${p.name}<br/><b>${fmt(p.value)}</b> · ${p.percent.toFixed(1).replace(".", ",")}%` },
      series: [
        {
          type: "pie",
          radius: ["58%", "90%"],
          padAngle: 1.5,
          cursor: onSelect ? "pointer" : "default",
          itemStyle: { borderRadius: 4, borderColor: t.surface, borderWidth: 2 },
          label: { show: false },
          emphasis: { scale: true, scaleSize: 4 },
          data: shown.map((i) => ({ name: i.name, value: i.value, itemStyle: { color: i.color } })),
        },
      ],
    }),
    [shown, fmt, onSelect],
  );

  const barOption = React.useCallback(
    (t: ChartTokens) => {
      const data = [...shown].reverse();
      return {
        aria: { enabled: true },
        grid: { left: 8, right: 16, top: 8, bottom: 8, containLabel: true },
        tooltip: { ...tooltipBase(t), trigger: "item", formatter: (p: { name: string; value: number }) => `${p.name}<br/><b>${fmt(p.value)}</b>` },
        xAxis: { type: "value", axisLabel: { color: t.ink3, fontSize: 11, formatter: (v: number) => (fmt(v).includes("•") ? "•••" : v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)) }, splitLine: { lineStyle: { color: t.grid } } },
        yAxis: { type: "category", data: data.map((i) => i.name), axisLabel: { color: t.ink2, fontSize: 12, width: 120, overflow: "truncate" }, axisLine: { lineStyle: { color: t.axis } }, axisTick: { show: false } },
        series: [
          {
            type: "bar",
            barMaxWidth: 18,
            cursor: onSelect ? "pointer" : "default",
            itemStyle: { borderRadius: [0, 4, 4, 0] },
            data: data.map((i) => ({ value: i.value, name: i.name, itemStyle: { color: i.color } })),
          },
        ],
      };
    },
    [shown, fmt, onSelect],
  );

  const handleClick = (p: { dataIndex: number; name: string }) => {
    if (!onSelect) return;
    const item = shown.find((i) => i.name === p.name);
    if (item && item.key !== "others") onSelect(item);
  };

  return (
    <Panel className={className}>
      <PanelHeader
        title={
          drill ? (
            <span className="flex items-center gap-1">
              <Button variant="ghost" size="icon-xs" aria-label="Voltar à visão geral" onClick={drill.onBack}>
                <ArrowLeft />
              </Button>
              {drill.title}
            </span>
          ) : (
            title
          )
        }
        description={
          total > 0 ? (
            <>
              Total <Money value={total} className={cn("font-medium", tone === "negative" ? "text-negative" : "text-positive")} />
            </>
          ) : undefined
        }
      />
      <div className="px-5 pb-5">
        {isPending ? (
          <ListSkeleton rows={5} />
        ) : isError ? (
          <ErrorState compact onRetry={onRetry} retrying={retrying} />
        ) : list.length === 0 ? (
          <EmptyState compact title={drill ? "Sem subcategorias com lançamentos" : "Sem lançamentos no período"} />
        ) : (
          <div className="grid gap-4">
            {showDrillHint && onSelect && (
              <p className="flex items-center gap-2 rounded-[var(--radius-md)] bg-brand-soft px-3 py-2 text-[13px] text-ink-2">
                <MousePointerClick className="size-4 text-brand-ink" aria-hidden /> Toque numa categoria para detalhar por subcategoria.
              </p>
            )}
            {chartType === "pie" && <EChart option={pieOption} height={240} label={`Gráfico de pizza: ${shown.map((i) => `${i.name} ${i.percent.toFixed(1)}%`).join(", ")}`} onItemClick={handleClick} />}
            {chartType === "bar" && <EChart option={barOption} height={Math.max(160, shown.length * 34)} label={`Gráfico de barras: ${shown.map((i) => `${i.name} ${i.percent.toFixed(1)}%`).join(", ")}`} onItemClick={handleClick} />}
            <ul className={cn("grid", chartType !== "list" && "gap-0.5")} aria-label={`${title}: itens`}>
              {(chartType === "list" ? list : shown).map((i) => {
                const content = (
                  <>
                    {i.icon ? <CategoryIcon icon={i.icon} color={i.color} size="sm" /> : <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: i.color }} aria-hidden />}
                    <span className="min-w-0 flex-1 truncate text-sm">{i.name}</span>
                    <span className="w-14 text-right text-xs tabular text-ink-3">{i.percent.toFixed(1).replace(".", ",")}%</span>
                    <Money value={i.value} className="w-28 text-right text-sm font-medium" />
                  </>
                );
                return (
                  <li key={i.key}>
                    {onSelect && i.key !== "others" && i.drillable !== false ? (
                      <button type="button" onClick={() => onSelect(i)} className="flex w-full items-center gap-3 rounded-[var(--radius-md)] px-2 py-1.5 text-left hover:bg-surface-2">
                        {content}
                      </button>
                    ) : (
                      <div className="flex items-center gap-3 px-2 py-1.5">{content}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </Panel>
  );
}
