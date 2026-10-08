"use client";
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, CalendarDays, ListFilter, Rows3, Search, Table2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Segmented } from "@/components/ui/segmented";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/shared/content-state";
import { Money } from "@/components/shared/money";
import { MonthSwitcher } from "@/components/shared/month-switcher";
import { api } from "@/data/api";
import { qk } from "@/data/query-keys";
import {
  computeMonthTotals,
  countActiveFilters,
  EMPTY_FILTERS,
  filterReleases,
  groupByDay,
  preselectionFromFilters,
  releaseTitle,
  signedAmount,
  type ReleaseFilters,
} from "@/domain/cash-flow";
import type { MonthlyRelease } from "@/domain/types";
import { usePicklists } from "@/features/picklists/queries";
import { usePrefs } from "@/features/prefs/store";
import { useReleaseContext } from "@/features/releases/context";
import { openReleaseDetails } from "@/features/releases/release-details";
import { ReleaseGlyph, ReleaseRow } from "@/features/releases/release-row";
import { useDoneOverrides } from "@/features/releases/use-done-overrides";
import { useToggleDone } from "@/features/releases/use-toggle-done";
import { isTyping } from "@/features/shell/shortcuts";
import { currentMonthKey, dayHeading, formatDate, shiftMonthKey, todayISO } from "@/lib/dates";
import { storage } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { FiltersDialog } from "./filters-dialog";
import { TotalsStrip } from "./totals-strip";

const MONTH_KEY = "finax.cashflow.month";

export function CashFlowView() {
  const [month, setMonth] = React.useState<string>(() => storage.get(MONTH_KEY, currentMonthKey()));
  const [filters, setFilters] = React.useState<ReleaseFilters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [view, setView] = React.useState<"timeline" | "table">("timeline");
  const searchRef = React.useRef<HTMLInputElement>(null);
  const { accounts, cards, categories } = usePicklists();
  const language = usePrefs((s) => s.language);

  const q = useQuery({ queryKey: qk.monthly(month), queryFn: () => api.releases.monthly(month), placeholderData: (prev) => prev });
  const { merged, patch } = useDoneOverrides(q.data);
  const toggleDone = useToggleDone(patch);

  const changeMonth = React.useCallback((m: string) => {
    setMonth(m);
    storage.set(MONTH_KEY, m);
  }, []);

  // Screen context for the global "+" (§4.10): focused month and filter preselection.
  React.useEffect(() => {
    useReleaseContext.getState().set({ monthKey: month, ...preselectionFromFilters(filters) });
    return () => useReleaseContext.getState().set({});
  }, [month, filters]);

  // ← / → change month, "/" focuses search.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e) || e.metaKey || e.ctrlKey || e.altKey || document.querySelector("[role=dialog]")) return;
      if (e.key === "ArrowLeft" && !q.isFetching) changeMonth(shiftMonthKey(month, -1));
      else if (e.key === "ArrowRight" && !q.isFetching) changeMonth(shiftMonthKey(month, 1));
      else if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      } else return;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [month, q.isFetching, changeMonth]);

  const filtered = React.useMemo(() => (merged ? filterReleases(merged, filters) : []), [merged, filters]);
  const totals = React.useMemo(() => computeMonthTotals(filtered), [filtered]);
  const activeCount = countActiveFilters(filters);

  const chips: { label: string; clear: () => void }[] = [];
  if (filters.type !== "ALL") chips.push({ label: { E: "Despesas", R: "Receitas", T: "Transferências" }[filters.type], clear: () => setFilters((f) => ({ ...f, type: "ALL" })) });
  if (filters.done !== "ALL") chips.push({ label: filters.done === "YES" ? "Realizados" : "Pendentes", clear: () => setFilters((f) => ({ ...f, done: "ALL" })) });
  for (const id of filters.accountIds) chips.push({ label: accounts.find((a) => a.id === id)?.displayName ?? "Conta", clear: () => setFilters((f) => ({ ...f, accountIds: f.accountIds.filter((x) => x !== id) })) });
  for (const id of filters.cardIds) chips.push({ label: cards.find((c) => c.id === id)?.displayName ?? "Cartão", clear: () => setFilters((f) => ({ ...f, cardIds: f.cardIds.filter((x) => x !== id) })) });
  for (const key of filters.categoryKeys) {
    const [kind, idStr] = key.split("-");
    const id = Number(idStr);
    const label = kind === "cat" ? categories.find((c) => c.id === id)?.name : categories.flatMap((c) => c.subcategories).find((s) => s.id === id)?.name;
    chips.push({ label: label ?? "Categoria", clear: () => setFilters((f) => ({ ...f, categoryKeys: f.categoryKeys.filter((x) => x !== key) })) });
  }

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-ink-3">Fluxo de caixa</p>
          <MonthSwitcher value={month} onChange={changeMonth} disabled={q.isFetching} size="lg" className="-ml-2" />
        </div>
        <Segmented
          label="Visualização"
          value={view}
          onValueChange={setView}
          className="hidden md:inline-flex"
          options={[
            { value: "timeline", label: "Por dia", icon: <Rows3 aria-hidden /> },
            { value: "table", label: "Tabela", icon: <Table2 aria-hidden /> },
          ]}
        />
      </header>

      {q.isPending ? <div className="skeleton h-[118px] rounded-[var(--radius-xl)]" /> : q.isSuccess && <TotalsStrip totals={totals} filtered={activeCount > 0} />}

      <div className="sticky top-14 z-20 -mx-4 flex flex-wrap items-center gap-2 bg-[color-mix(in_srgb,var(--bg)_92%,transparent)] px-4 py-2 backdrop-blur-md md:top-0 md:-mx-1 md:px-1">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <Input
            ref={searchRef}
            value={filters.description}
            maxLength={50}
            onChange={(e) => setFilters((f) => ({ ...f, description: e.target.value }))}
            placeholder="Buscar descrição ou categoria"
            aria-label="Buscar por descrição ou categoria"
            className="pl-9 pr-10"
          />
          <Kbd className="absolute right-2.5 top-1/2 hidden -translate-y-1/2 sm:inline-flex">/</Kbd>
        </div>
        <Segmented
          size="md"
          label="Tipo de lançamento"
          className="hidden lg:inline-flex"
          value={filters.type}
          onValueChange={(type) => setFilters((f) => ({ ...f, type }))}
          options={[
            { value: "ALL", label: "Todos" },
            { value: "E", label: "Despesas" },
            { value: "R", label: "Receitas" },
            { value: "T", label: "Transferências" },
          ]}
        />
        <Button onClick={() => setFiltersOpen(true)} aria-label={`Filtros${activeCount ? `, ${activeCount} ativos` : ""}`}>
          <ListFilter aria-hidden />
          <span className="hidden sm:inline">Filtros</span>
          {activeCount > 0 && <span className="rounded-full bg-ink px-1.5 text-[11px] font-semibold text-bg">{activeCount}</span>}
        </Button>
        {q.isFetching && !q.isPending && <span className="text-xs text-ink-3" role="status">Atualizando…</span>}
      </div>

      {chips.length > 0 && (
        <div className="-mt-3 flex flex-wrap items-center gap-1.5">
          {chips.map((c) => (
            <button key={c.label} type="button" onClick={c.clear} className="inline-flex h-7 items-center gap-1 rounded-full border border-line-strong bg-surface pl-2.5 pr-1.5 text-xs hover:bg-surface-2" aria-label={`Remover filtro ${c.label}`}>
              {c.label} <X className="size-3" aria-hidden />
            </button>
          ))}
          <Button variant="ghost" size="xs" onClick={() => setFilters(EMPTY_FILTERS)}>
            Limpar tudo
          </Button>
        </div>
      )}

      {q.isPending ? (
        <ListSkeleton rows={8} />
      ) : q.isError && !q.data ? (
        <ErrorState onRetry={() => q.refetch()} retrying={q.isFetching} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<CalendarDays />}
          title={activeCount ? "Nenhum lançamento com esses filtros" : "Nenhum lançamento no mês"}
          message={activeCount ? "Ajuste ou limpe os filtros." : "Use “Novo lançamento” para registrar receitas, despesas e transferências."}
          action={activeCount ? <Button onClick={() => setFilters(EMPTY_FILTERS)}>Limpar filtros</Button> : undefined}
        />
      ) : view === "table" ? (
        <ReleasesTable data={filtered} onToggle={toggleDone} />
      ) : (
        <Timeline data={filtered} onToggle={toggleDone} language={language} />
      )}

      <FiltersDialog key={filtersOpen ? "open" : "closed"} open={filtersOpen} onOpenChange={setFiltersOpen} value={filters} onApply={setFilters} />
    </div>
  );
}

/** Keeps the window-virtualizer offset in sync with the list's document position. */
function useScrollMargin(ref: React.RefObject<HTMLElement | null>, margin: number, setMargin: (n: number) => void) {
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const top = Math.round(el.getBoundingClientRect().top + window.scrollY);
    if (top !== margin) setMargin(top);
  });
}

/* ───────────── Timeline (virtualised, grouped by day) ───────────── */

type FlatRow = { kind: "day"; date: string; net: number; count: number } | { kind: "item"; release: MonthlyRelease };

function Timeline({ data, onToggle, language }: { data: MonthlyRelease[]; onToggle: (r: MonthlyRelease) => void; language: ReturnType<typeof usePrefs.getState>["language"] }) {
  const rows = React.useMemo<FlatRow[]>(() => groupByDay(data).flatMap((g) => [{ kind: "day" as const, date: g.date, net: g.net, count: g.items.length }, ...g.items.map((release) => ({ kind: "item" as const, release }))]), [data]);
  const listRef = React.useRef<HTMLDivElement>(null);
  const [margin, setMargin] = React.useState(0);
  useScrollMargin(listRef, margin, setMargin);
  const today = todayISO();

  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: (i) => (rows[i].kind === "day" ? 48 : 64),
    overscan: 8,
    scrollMargin: margin,
  });

  return (
    <div ref={listRef} role="list" aria-label="Lançamentos do mês" className="relative" style={{ height: virtualizer.getTotalSize() }}>
      {virtualizer.getVirtualItems().map((v) => {
        const row = rows[v.index];
        return (
          <div
            key={row.kind === "day" ? `d-${row.date}` : row.release.key}
            data-index={v.index}
            ref={virtualizer.measureElement}
            role={row.kind === "day" ? "presentation" : "listitem"}
            className="absolute inset-x-0"
            style={{ transform: `translateY(${v.start - virtualizer.options.scrollMargin}px)` }}
          >
            {row.kind === "day" ? (
              <h3 className="flex items-baseline justify-between gap-3 border-b border-line px-3 pb-2 pt-5 text-[13px]">
                <span className="font-semibold text-ink">
                  {dayHeading(row.date, language)}
                  {row.date === today && <Badge tone="brand" className="ml-2 align-middle">Hoje</Badge>}
                  <span className="ml-2 font-normal text-ink-3">{formatDate(row.date)}</span>
                </span>
                <Money value={row.net} signed className="text-xs text-ink-3" />
              </h3>
            ) : (
              <ReleaseRow release={row.release} onOpen={openReleaseDetails} onToggleDone={onToggle} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ───────────── Table (TanStack Table + virtual) ───────────── */

const col = createColumnHelper<MonthlyRelease>();

function ReleasesTable({ data, onToggle }: { data: MonthlyRelease[]; onToggle: (r: MonthlyRelease) => void }) {
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "date", desc: false }]);
  const columns = React.useMemo(
    () => [
      col.accessor("date", { header: "Data", cell: (c) => <span className="tabular">{formatDate(c.getValue())}</span>, sortingFn: (a, b) => (a.original.date + (a.original.time ?? "")).localeCompare(b.original.date + (b.original.time ?? "")) }),
      col.accessor((r) => releaseTitle(r), {
        id: "title",
        header: "Descrição",
        cell: (c) => (
          <span className="flex items-center gap-2.5">
            <ReleaseGlyph r={c.row.original} size="sm" />
            <span className="truncate font-medium">{c.getValue()}</span>
          </span>
        ),
      }),
      col.accessor((r) => (r.subcategory ? `${r.category?.name} › ${r.subcategory.name}` : r.category?.name ?? (r.type === "T" ? "Transferência" : "—")), { id: "category", header: "Categoria" }),
      col.accessor((r) => (r.type === "T" ? `${r.account?.name} → ${r.targetAccount?.name}` : r.card?.name ?? r.account?.name ?? "—"), { id: "source", header: "Conta / cartão" }),
      col.accessor((r) => signedAmount(r), {
        id: "amount",
        header: "Valor",
        cell: (c) => <Money value={c.getValue()} signed={c.getValue() > 0} className={cn("font-semibold", c.row.original.type === "E" ? "text-negative" : c.row.original.type === "R" ? "text-positive" : "text-transfer")} />,
      }),
      col.accessor("done", {
        header: "Status",
        cell: (c) =>
          c.row.original.kind === "INVOICE_PAYMENT" ? (
            <span className="text-xs text-ink-3">Pago</span>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggle(c.row.original);
              }}
              aria-pressed={c.getValue()}
              className={cn("rounded-full px-2 py-0.5 text-xs font-medium", c.getValue() ? "bg-positive-soft text-positive" : "bg-warning-soft text-warning")}
            >
              {c.getValue() ? "Realizado" : "Pendente"}
            </button>
          ),
      }),
    ],
    [onToggle],
  );
  const table = useReactTable({ data, columns, state: { sorting }, onSortingChange: setSorting, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel() });
  const rows = table.getRowModel().rows;
  const ref = React.useRef<HTMLTableSectionElement>(null);
  const [margin, setMargin] = React.useState(0);
  useScrollMargin(ref, margin, setMargin);
  const virtualizer = useWindowVirtualizer({ count: rows.length, estimateSize: () => 52, overscan: 10, scrollMargin: margin });
  const items = virtualizer.getVirtualItems();
  const padTop = items.length ? items[0].start - margin : 0;
  const padBottom = items.length ? virtualizer.getTotalSize() - (items[items.length - 1].end - margin) : 0;

  return (
    <div className="overflow-x-auto rounded-[var(--radius-xl)] border border-line bg-surface">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id} className="border-b border-line">
              {hg.headers.map((h) => {
                const sorted = h.column.getIsSorted();
                return (
                  <th key={h.id} scope="col" aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none"} className={cn("px-4 py-2.5 text-left text-xs font-medium text-ink-3", h.id === "amount" && "text-right")}>
                    <button type="button" onClick={h.column.getToggleSortingHandler()} className="inline-flex items-center gap-1 hover:text-ink">
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      {sorted === "asc" ? <ArrowUp className="size-3" aria-hidden /> : sorted === "desc" ? <ArrowDown className="size-3" aria-hidden /> : null}
                    </button>
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody ref={ref}>
          {padTop > 0 && (
            <tr aria-hidden>
              <td style={{ height: padTop }} colSpan={columns.length} />
            </tr>
          )}
          {items.map((v) => {
            const row = rows[v.index];
            return (
              <tr
                key={row.id}
                data-index={v.index}
                ref={virtualizer.measureElement}
                tabIndex={0}
                onClick={() => openReleaseDetails(row.original)}
                onKeyDown={(e) => e.key === "Enter" && openReleaseDetails(row.original)}
                className="cursor-pointer border-b border-line last:border-0 hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none"
              >
                {row.getVisibleCells().map((c) => (
                  <td key={c.id} className={cn("max-w-[260px] truncate px-4 py-2.5", c.column.id === "amount" && "text-right")}>
                    {flexRender(c.column.columnDef.cell, c.getContext())}
                  </td>
                ))}
              </tr>
            );
          })}
          {padBottom > 0 && (
            <tr aria-hidden>
              <td style={{ height: padBottom }} colSpan={columns.length} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
