"use client";
import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, CalendarCheck2, CreditCard, Info, Landmark, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/menu";
import { Segmented } from "@/components/ui/segmented";
import { EChart, tooltipBase } from "@/components/charts/echart";
import { CategoryIcon } from "@/components/shared/category-icon";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/shared/content-state";
import { InstitutionLogo } from "@/components/shared/institution-logo";
import { Money, useMoneyFormatter } from "@/components/shared/money";
import { Panel, PanelHeader } from "@/components/shared/page-header";
import { api } from "@/data/api";
import { qk } from "@/data/query-keys";
import type { HomeInterval, HomeUpcomingRelease } from "@/domain/types";
import { openNewAccountWizard } from "@/features/accounts/new-account-wizard";
import { useOverallBalance } from "@/features/accounts/queries";
import { usePrefs } from "@/features/prefs/store";
import { useSession } from "@/features/session/store";
import { HideValuesToggle } from "@/features/shell/hide-values-toggle";
import { daysBetween, formatDate, formatDayMonth, monthLabel, currentMonthKey, todayISO } from "@/lib/dates";
import { cn } from "@/lib/utils";

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

/* ───────────── Hero: overall balance + month ───────────── */

function BalanceHero() {
  const overall = useOverallBalance();
  const month = useQuery({ queryKey: qk.home.revenueExpense, queryFn: api.home.revenueExpense });
  const language = usePrefs((s) => s.language);
  const balance = overall.data?.overallBalance ?? 0;
  return (
    <section aria-labelledby="hero-title" className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-end">
      <div>
        <div className="flex items-center gap-1">
          <h2 id="hero-title" className="text-sm font-medium text-ink-3">
            Saldo geral
          </h2>
          <Tooltip content="Soma das contas marcadas para o saldo geral, cofrinhos e investimentos. Contas arquivadas não entram.">
            <button type="button" aria-label="Sobre o saldo geral" className="grid size-6 place-items-center rounded-full text-ink-3 hover:text-ink">
              <Info className="size-3.5" />
            </button>
          </Tooltip>
          <HideValuesToggle />
        </div>
        {overall.isPending ? (
          <div className="skeleton mt-2 h-16 w-72" />
        ) : overall.isError ? (
          <div className="mt-2 flex items-center gap-3">
            <p className="font-display text-6xl text-ink-3">R$ •••</p>
            <Button size="sm" onClick={() => overall.refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : (
          <p className={cn("mt-1 font-display text-[56px] leading-none tracking-tight sm:text-[76px]", balance < 0 && "text-negative")}>
            <Money value={balance} />
          </p>
        )}
        <p className="mt-3 text-sm text-ink-3">
          {balance >= 0 ? "Seu patrimônio líquido disponível hoje." : "Atenção: seu saldo geral está negativo."}{" "}
          <Link href="/contas" className="font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
            Ver composição
          </Link>
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <MonthStat label={`Receitas · ${monthLabel(currentMonthKey(), language)}`} icon={<ArrowDownLeft />} tone="positive" value={month.data?.revenues} pending={month.isPending} error={month.isError} onRetry={() => month.refetch()} />
        <MonthStat label={`Despesas · ${monthLabel(currentMonthKey(), language)}`} icon={<ArrowUpRight />} tone="negative" value={month.data?.expenses} pending={month.isPending} error={month.isError} onRetry={() => month.refetch()} />
      </div>
    </section>
  );
}

function MonthStat({ label, icon, tone, value, pending, error, onRetry }: { label: string; icon: React.ReactNode; tone: "positive" | "negative"; value?: number; pending: boolean; error: boolean; onRetry: () => void }) {
  return (
    <div className="rounded-[var(--radius-xl)] border border-line bg-surface p-4">
      <p className="flex items-center gap-2 text-[13px] text-ink-3">
        <span className={cn("grid size-6 place-items-center rounded-full [&_svg]:size-3.5", tone === "positive" ? "bg-positive-soft text-positive" : "bg-negative-soft text-negative")} aria-hidden>
          {icon}
        </span>
        {label}
      </p>
      {pending ? (
        <div className="skeleton mt-3 h-7 w-28" />
      ) : error ? (
        <button type="button" onClick={onRetry} className="mt-3 text-sm text-negative underline">
          Erro · tentar novamente
        </button>
      ) : (
        <p className="mt-2 text-2xl font-semibold tracking-tight">
          <Money value={value ?? 0} />
        </p>
      )}
      <p className="mt-0.5 text-xs text-ink-3">realizado no mês</p>
    </div>
  );
}

/* ───────────── Upcoming ───────────── */

function dueState(date: string): { label: string; tone: "negative" | "warning" | "neutral" } {
  const diff = daysBetween(todayISO(), date);
  if (diff < 0) return { label: `Atrasado · ${formatDayMonth(date)}`, tone: "negative" };
  if (diff === 0) return { label: "Vence hoje", tone: "warning" };
  if (diff === 1) return { label: "Amanhã", tone: "neutral" };
  return { label: formatDayMonth(date), tone: "neutral" };
}

function Upcoming() {
  const [tab, setTab] = React.useState<"E" | "R">("E");
  const q = useQuery({ queryKey: qk.home.upcoming, queryFn: api.home.upcoming });
  const items = (q.data ?? []).filter((i) => i.type === tab);
  return (
    <Panel className="lg:row-span-2">
      <PanelHeader
        title="Próximos 30 dias"
        description="Lançamentos pendentes, incluindo atrasados."
        actions={
          <Segmented
            size="sm"
            label="Tipo"
            value={tab}
            onValueChange={setTab}
            options={[
              { value: "E", label: "A pagar" },
              { value: "R", label: "A receber" },
            ]}
          />
        }
      />
      <div className="px-2 pb-3">
        {q.isPending ? (
          <ListSkeleton rows={5} className="px-3 py-2" />
        ) : q.isError ? (
          <ErrorState compact onRetry={() => q.refetch()} retrying={q.isFetching} />
        ) : items.length === 0 ? (
          <EmptyState compact icon={<CalendarCheck2 />} title={tab === "E" ? "Nada a pagar por enquanto" : "Nada a receber por enquanto"} message="Lançamentos pendentes dos próximos 30 dias aparecem aqui." />
        ) : (
          <ul className="grid">
            {items.slice(0, 9).map((i) => (
              <UpcomingRow key={i.id} item={i} />
            ))}
          </ul>
        )}
        {items.length > 0 && (
          <div className="px-3 pt-2">
            <Button asChild variant="ghost" size="sm" className="-ml-2">
              <Link href="/fluxo-de-caixa">
                Ver no fluxo de caixa <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
        )}
      </div>
    </Panel>
  );
}

function UpcomingRow({ item }: { item: HomeUpcomingRelease }) {
  const due = dueState(item.date);
  const title = item.description || item.subcategoryName || item.categoryName;
  return (
    <li className="flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5">
      <CategoryIcon icon={item.categoryIcon} color={item.categoryColor} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{title}</p>
        <p className="flex items-center gap-1.5 truncate text-xs text-ink-3">
          {item.isCreditCardRelease && <CreditCard className="size-3" aria-label="Cartão" />}
          {item.sourceName}
          {!item.active && <Badge tone="warning">{item.isCreditCardRelease ? "Arquivado" : "Arquivada"}</Badge>}
        </p>
      </div>
      <div className="text-right">
        <Money value={item.amount} className="text-sm font-medium" />
        <p className={cn("text-xs", due.tone === "negative" ? "font-medium text-negative" : due.tone === "warning" ? "font-medium text-warning" : "text-ink-3")}>{due.label}</p>
      </div>
    </li>
  );
}

/* ───────────── Accounts & cards ───────────── */

function MyAccounts() {
  const q = useQuery({ queryKey: qk.home.accounts, queryFn: api.home.accounts });
  return (
    <Panel>
      <PanelHeader
        title="Minhas contas"
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href="/contas">
              Ver todas <ArrowRight aria-hidden />
            </Link>
          </Button>
        }
      />
      <div className="px-2 pb-3">
        {q.isPending ? (
          <ListSkeleton rows={3} className="px-3 py-2" />
        ) : q.isError ? (
          <ErrorState compact onRetry={() => q.refetch()} retrying={q.isFetching} />
        ) : q.data.length === 0 ? (
          <EmptyState
            compact
            icon={<Landmark />}
            title="Nenhuma conta ainda"
            message="Cadastre onde seu dinheiro está para acompanhar o saldo."
            action={
              <Button variant="primary" size="sm" onClick={() => openNewAccountWizard(() => q.refetch())}>
                <Plus aria-hidden /> Cadastrar uma
              </Button>
            }
          />
        ) : (
          <ul>
            {q.data.map((i) => (
              <li key={i.key}>
                <Link href="/contas" className="flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 hover:bg-surface-2">
                  <InstitutionLogo institutionId={i.institutionId} name={i.name} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-sm">{i.name}</span>
                  <Money value={i.balance} tone={i.balance < 0 ? "negative" : "neutral"} className="text-sm font-medium" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}

function MyCards() {
  const q = useQuery({ queryKey: qk.home.cards, queryFn: api.home.creditCards });
  return (
    <Panel>
      <PanelHeader title="Cartões de crédito" />
      <div className="px-2 pb-3">
        {q.isPending ? (
          <ListSkeleton rows={2} className="px-3 py-2" />
        ) : q.isError ? (
          <ErrorState compact onRetry={() => q.refetch()} retrying={q.isFetching} />
        ) : q.data.length === 0 ? (
          <EmptyState compact icon={<CreditCard />} title="Nenhum cartão cadastrado" message="Cadastre seus cartões em Cartões de crédito." />
        ) : (
          <ul className="grid gap-1">
            {q.data.map((c) => (
              <li key={c.cardId} className="flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2">
                <InstitutionLogo institutionId={c.institutionId} name={c.cardName} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.cardName}</p>
                  <p className="text-xs text-ink-3">
                    Disponível <Money value={c.invoiceSummary.availableLimit} />
                  </p>
                </div>
                <div className="text-right">
                  <Money value={c.invoiceSummary.currentInvoiceAmount} className="text-sm font-medium" />
                  <Link href={`/cartoes-de-credito/fatura/${c.cardId}`} className="block text-xs font-medium text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink">
                    Ver fatura
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}

/* ───────────── Spending ───────────── */

const INTERVAL_OPTIONS: { value: HomeInterval; label: string }[] = [
  { value: "LAST_30_DAYS", label: "30 dias" },
  { value: "CURRENT_MONTH", label: "Mês atual" },
];

function SpendsByCategory() {
  const interval = usePrefs((s) => s.homeSpendsInterval);
  const set = usePrefs((s) => s.set);
  const fmt = useMoneyFormatter();
  const q = useQuery({ queryKey: qk.home.spends(interval), queryFn: () => api.home.spendsByCategory(interval) });
  const list = React.useMemo(() => q.data?.spendByCategories ?? [], [q.data]);
  const option = React.useCallback(
    (t: Parameters<React.ComponentProps<typeof EChart>["option"]>[0]) => ({
      tooltip: { ...tooltipBase(t), trigger: "item", formatter: (p: { name: string; value: number; percent: number }) => `${p.name}<br/><b>${fmt(p.value)}</b> · ${p.percent.toFixed(1).replace(".", ",")}%` },
      series: [
        {
          type: "pie",
          radius: ["62%", "92%"],
          padAngle: 1.5,
          itemStyle: { borderRadius: 4, borderColor: t.surface, borderWidth: 2 },
          label: { show: false },
          data: list.map((c) => ({ name: c.categoryName, value: c.value, itemStyle: { color: c.color } })),
        },
      ],
    }),
    [list, fmt],
  );
  return (
    <Panel>
      <PanelHeader
        title="Gastos por categoria"
        description={q.data ? `${formatDate(q.data.startDate)} – ${formatDate(q.data.endDate)}` : " "}
        actions={<Segmented size="sm" label="Período" value={interval} onValueChange={(v) => set({ homeSpendsInterval: v })} options={INTERVAL_OPTIONS} />}
      />
      <div className="px-5 pb-5">
        {q.isPending ? (
          <ListSkeleton rows={4} />
        ) : q.isError ? (
          <ErrorState compact onRetry={() => q.refetch()} retrying={q.isFetching} />
        ) : list.length === 0 ? (
          <EmptyState compact title="Sem despesas no período" />
        ) : (
          <div className="grid items-center gap-5 sm:grid-cols-[180px_1fr]">
            <div className="relative mx-auto w-[180px]">
              <EChart option={option} height={180} label={`Gráfico de rosca dos gastos por categoria: ${list.map((c) => `${c.categoryName} ${c.percent}%`).join(", ")}`} />
              <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                <div>
                  <p className="text-[11px] text-ink-3">Total</p>
                  <Money value={list.reduce((s, c) => s + c.value, 0)} className="text-sm font-semibold" />
                </div>
              </div>
            </div>
            <ul className="grid gap-2">
              {list.slice(0, 6).map((c) => (
                <li key={c.categoryId} className="flex items-center gap-2.5 text-sm">
                  <CategoryIcon icon={c.icon} color={c.color} size="xs" />
                  <span className="min-w-0 flex-1 truncate">{c.categoryName}</span>
                  <span className="w-12 text-right tabular text-xs text-ink-3">{c.percent.toFixed(0)}%</span>
                  <Money value={c.value} className="w-24 text-right font-medium" />
                </li>
              ))}
              {list.length > 6 && <li className="text-xs text-ink-3">+ {list.length - 6} categorias</li>}
            </ul>
          </div>
        )}
      </div>
    </Panel>
  );
}

function EssentialSplit() {
  const interval = usePrefs((s) => s.homeEssentialInterval);
  const set = usePrefs((s) => s.set);
  const q = useQuery({ queryKey: qk.home.essential(interval), queryFn: () => api.home.essentialExpenses(interval) });
  const d = q.data;
  const empty = d && d.essentialValue === 0 && d.notEssentialValue === 0;
  return (
    <Panel>
      <PanelHeader
        title="Essenciais × não essenciais"
        description={d ? `${formatDate(d.startDate)} – ${formatDate(d.endDate)}` : " "}
        actions={<Segmented size="sm" label="Período" value={interval} onValueChange={(v) => set({ homeEssentialInterval: v })} options={INTERVAL_OPTIONS} />}
      />
      <div className="px-5 pb-5">
        {q.isPending ? (
          <ListSkeleton rows={2} />
        ) : q.isError ? (
          <ErrorState compact onRetry={() => q.refetch()} retrying={q.isFetching} />
        ) : empty || !d ? (
          <EmptyState compact title="Sem despesas no período" />
        ) : (
          <div className="grid gap-4">
            <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={`Essenciais ${d.essentialPercent}%, não essenciais ${d.notEssentialPercent}%`}>
              <div className="rounded-l-full bg-ink" style={{ width: `${d.essentialPercent}%` }} />
              <div className="rounded-r-full bg-brand" style={{ width: `${d.notEssentialPercent}%` }} />
            </div>
            <dl className="grid grid-cols-2 gap-3">
              <div>
                <dt className="flex items-center gap-2 text-[13px] text-ink-3">
                  <span className="size-2.5 rounded-full bg-ink" aria-hidden /> Essenciais
                </dt>
                <dd className="mt-1 text-xl font-semibold">
                  <Money value={d.essentialValue} />
                </dd>
                <dd className="text-xs text-ink-3">{d.essentialPercent.toFixed(1).replace(".", ",")}% dos gastos</dd>
              </div>
              <div>
                <dt className="flex items-center gap-2 text-[13px] text-ink-3">
                  <span className="size-2.5 rounded-full bg-brand ring-1 ring-line-strong" aria-hidden /> Não essenciais
                </dt>
                <dd className="mt-1 text-xl font-semibold">
                  <Money value={d.notEssentialValue} />
                </dd>
                <dd className="text-xs text-ink-3">{d.notEssentialPercent.toFixed(1).replace(".", ",")}% dos gastos</dd>
              </div>
            </dl>
          </div>
        )}
      </div>
    </Panel>
  );
}

/* ───────────── Page ───────────── */

export function HomeView() {
  const user = useSession((s) => s.user);
  const language = usePrefs((s) => s.language);
  return (
    <div className="grid gap-8">
      <p className="text-sm text-ink-3">
        {greeting()}, <span className="font-medium text-ink">{user?.firstName}</span> · {monthLabel(currentMonthKey(), language)} de {new Date().getFullYear()}
      </p>
      <BalanceHero />
      <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        <Upcoming />
        <MyAccounts />
        <MyCards />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <SpendsByCategory />
        <EssentialSplit />
      </div>
    </div>
  );
}
