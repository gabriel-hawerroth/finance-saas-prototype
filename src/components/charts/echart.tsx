"use client";
import * as React from "react";
import * as echarts from "echarts/core";
import { BarChart, LineChart, PieChart } from "echarts/charts";
import { AriaComponent, GridComponent, MarkLineComponent, TooltipComponent } from "echarts/components";
import { SVGRenderer } from "echarts/renderers";
import type { EChartsCoreOption } from "echarts/core";

echarts.use([BarChart, LineChart, PieChart, GridComponent, TooltipComponent, AriaComponent, MarkLineComponent, SVGRenderer]);

export interface ChartTokens {
  ink: string;
  ink2: string;
  ink3: string;
  grid: string;
  axis: string;
  surface: string;
  positive: string;
  negative: string;
  transfer: string;
  brand: string;
  fontFamily: string;
}

function readTokens(): ChartTokens {
  const s = getComputedStyle(document.documentElement);
  const v = (n: string) => s.getPropertyValue(n).trim();
  return {
    ink: v("--ink"),
    ink2: v("--ink-2"),
    ink3: v("--ink-3"),
    grid: v("--chart-grid"),
    axis: v("--chart-axis"),
    surface: v("--surface"),
    positive: v("--positive"),
    negative: v("--negative"),
    transfer: v("--transfer"),
    brand: v("--brand"),
    fontFamily: getComputedStyle(document.body).fontFamily,
  };
}

/** Re-reads tokens whenever the theme class on <html> changes. */
function useChartTokens(): ChartTokens | null {
  const themeClass = React.useSyncExternalStore(
    (cb) => {
      const obs = new MutationObserver(cb);
      obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
      return () => obs.disconnect();
    },
    () => document.documentElement.className,
    () => null,
  );
  return React.useMemo(() => (themeClass === null ? null : readTokens()), [themeClass]);
}

interface EChartProps {
  /** Builds the option from the current theme tokens. */
  option: (t: ChartTokens) => EChartsCoreOption;
  height: number;
  /** Accessible summary: charts are always paired with a text/table alternative. */
  label: string;
  onItemClick?: (params: { dataIndex: number; name: string }) => void;
  className?: string;
}

/** Thin, tree-shaken ECharts wrapper: SVG renderer, theme tokens, resize, click events. */
export function EChart({ option, height, label, onItemClick, className }: EChartProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const chart = React.useRef<echarts.ECharts | null>(null);
  const tokens = useChartTokens();
  const clickRef = React.useRef(onItemClick);
  React.useEffect(() => {
    clickRef.current = onItemClick;
  }, [onItemClick]);

  React.useEffect(() => {
    if (!ref.current) return;
    const c = echarts.init(ref.current, undefined, { renderer: "svg" });
    chart.current = c;
    c.on("click", (p) => clickRef.current?.({ dataIndex: (p as { dataIndex: number }).dataIndex, name: (p as { name: string }).name }));
    const ro = new ResizeObserver(() => c.resize());
    ro.observe(ref.current);
    return () => {
      ro.disconnect();
      c.dispose();
      chart.current = null;
    };
  }, []);

  React.useEffect(() => {
    if (!chart.current || !tokens) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    chart.current.setOption({ animation: !reduce, animationDuration: 500, textStyle: { fontFamily: tokens.fontFamily }, ...option(tokens) }, true);
  }, [option, tokens]);

  return <div ref={ref} role="img" aria-label={label} className={className} style={{ height, width: "100%" }} />;
}

export function tooltipBase(t: ChartTokens) {
  return {
    backgroundColor: t.surface,
    borderColor: t.grid,
    borderWidth: 1,
    padding: [8, 12],
    textStyle: { color: t.ink, fontSize: 12, fontFamily: t.fontFamily },
    extraCssText: "border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.12);",
  };
}
