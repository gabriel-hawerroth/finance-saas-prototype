"use client";
import * as React from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, Info, ReceiptText, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/shared/content-state";
import { InstitutionLogo } from "@/components/shared/institution-logo";
import { Money } from "@/components/shared/money";
import { api } from "@/data/api";
import { qk } from "@/data/query-keys";
import { groupByDay } from "@/domain/cash-flow";
import { invoiceForecast, pickInitialCycle } from "@/domain/invoice";
import type { Id, InvoiceOption, ISODate, MonthlyRelease } from "@/domain/types";
import { usePrefs } from "@/features/prefs/store";
import { useReleaseContext } from "@/features/releases/context";
import { openReleaseDetails } from "@/features/releases/release-details";
import { ReleaseRow } from "@/features/releases/release-row";
import { useDoneOverrides } from "@/features/releases/use-done-overrides";
import { useToggleDone } from "@/features/releases/use-toggle-done";
import { isTyping } from "@/features/shell/shortcuts";
import { dayHeading, formatDate, formatDayMonth } from "@/lib/dates";
import { invoiceLabel } from "@/lib/format";
import { storage } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { openDateCorrection, openInvoiceDetails, openPaymentDialog, openPaymentsList, STATUS_LABEL } from "./invoice-dialogs";

const LAST_INVOICE_KEY = "finax.invoice.last";

export function InvoiceView() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const cardId = Number(params.id) as Id;
  const deepLink = search.get("fatura") ? Number(search.get("fatura")) : null;
  const language = usePrefs((s) => s.language);

  const cardQ = useQuery({ queryKey: qk.card(cardId), queryFn: () => api.cards.get(cardId) });
  const optionsQ = useQuery({ queryKey: qk.invoices(cardId), queryFn: () => api.invoices.byCard(cardId) });
  const [chosenClose, setCloseDate] = React.useState<ISODate | null>(null);
  // C16 — initial cycle, until the user navigates.
  const initialClose = React.useMemo(
    () => (optionsQ.data ? pickInitialCycle(optionsQ.data, deepLink, storage.get<Id | null>(LAST_INVOICE_KEY, null))?.closeDay ?? null : null),
    [optionsQ.data, deepLink],
  );
  const closeDate = chosenClose ?? initialClose;

  const valuesQ = useQuery({
    queryKey: qk.cycle(cardId, closeDate ?? ""),
    queryFn: () => api.invoices.cycleValues(cardId, closeDate!),
    enabled: closeDate != null,
    placeholderData: (prev) => prev,
  });
  const v = valuesQ.data;

  React.useEffect(() => {
    if (!v) return;
    if (v.invoiceId != null) storage.set(LAST_INVOICE_KEY, v.invoiceId);
    else storage.remove(LAST_INVOICE_KEY);
  }, [v]);

  React.useEffect(() => {
    useReleaseContext.getState().set({ cardId });
    return () => useReleaseContext.getState().set({});
  }, [cardId]);

  const { merged, patch } = useDoneOverrides(v?.releases);
  const toggleDone = useToggleDone(patch);
  const releases: MonthlyRelease[] = merged ?? [];

  const navigating = valuesQ.isFetching;
  const go = React.useCallback((d: ISODate | undefined) => d && setCloseDate(d), []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!v || navigating || isTyping(e) || e.metaKey || e.ctrlKey || document.querySelector("[role=dialog]")) return;
      if (e.key === "ArrowLeft") go(v.previousCloseDate);
      else if (e.key === "ArrowRight") go(v.nextCloseDate);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [v, navigating, go]);

  const card = cardQ.data;
  const showDetails = () =>
    v &&
    card &&
    openInvoiceDetails(v, (intent) => {
      if (intent === "pay") openPaymentDialog(card, v);
      else if (intent === "payments") openPaymentsList(card, v);
      else openDateCorrection(v, (d) => setCloseDate(d));
    });

  if (cardQ.isError || optionsQ.isError) {
    return <ErrorState onRetry={() => (cardQ.refetch(), optionsQ.refetch())} />;
  }

  const groups = groupByDay(releases);

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" className="-ml-2" onClick={() => router.push("/cartoes-de-credito")}>
          <ArrowLeft aria-hidden /> Cartões
        </Button>
        {card && (
          <Link href={`/cartoes-de-credito/${card.id}`} className="flex items-center gap-2.5 rounded-[var(--radius-md)] px-2 py-1 hover:bg-surface-2" aria-label={`Editar cartão ${card.displayName}`}>
            <InstitutionLogo institutionId={card.institutionId} name={card.displayName} size="sm" />
            <span className="text-sm font-medium">{card.displayName}</span>
          </Link>
        )}
      </div>

      {/* Cycle header */}
      <section aria-labelledby="inv-title" className="rounded-[var(--radius-2xl)] border border-line bg-surface p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" aria-label="Fatura anterior" disabled={!v || navigating} onClick={() => go(v?.previousCloseDate)}>
              <ChevronLeft />
            </Button>
            <button type="button" onClick={showDetails} disabled={!v} className="rounded-[var(--radius-md)] px-2 py-1 text-left hover:bg-surface-2" aria-label="Detalhes da fatura">
              <span id="inv-title" aria-live="polite" className="flex items-center gap-2 font-display text-[34px] leading-none sm:text-[40px]">
                {v ? invoiceLabel(v, language) : "…"}
                <Info className="size-4 text-ink-3" aria-hidden />
              </span>
            </button>
            <Button variant="ghost" size="icon-sm" aria-label="Próxima fatura" disabled={!v || navigating} onClick={() => go(v?.nextCloseDate)}>
              <ChevronRight />
            </Button>
          </div>
          {v && (
            <div className="flex items-center gap-2">
              <Badge tone={v.status === "OPEN" ? "brand" : v.status === "CLOSED" ? "warning" : "neutral"} size="md">
                {STATUS_LABEL[v.status]}
              </Badge>
              {v.canPay && card ? (
                <Button variant="primary" onClick={() => openPaymentDialog(card, v)}>
                  <Wallet aria-hidden /> Pagar
                </Button>
              ) : v.amount > 0 && v.settled ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-positive-soft px-3 py-1.5 text-sm font-medium text-positive">
                  <CheckCircle2 className="size-4" aria-hidden />
                  {v.settledByDueDate ? `Quitada na fatura de ${formatDate(v.settledByDueDate)}` : "Quitada"}
                </span>
              ) : null}
            </div>
          )}
        </div>

        {!v ? (
          <div className="skeleton mt-6 h-16" />
        ) : (
          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
            <Kpi label="Fechamento" value={formatDayMonth(v.closeDay)} />
            <Kpi label="Vencimento" value={formatDayMonth(v.dueDate)} />
            <Kpi label="Valor da fatura" value={<Money value={v.amount} />} strong />
            <Kpi label="Valor previsto" value={<Money value={invoiceForecast(v)} />} hint="inclui pendentes" />
          </dl>
        )}
      </section>

      {optionsQ.data && <CycleStrip options={optionsQ.data} current={v?.closeDay ?? closeDate} onPick={go} language={language} />}

      {!v ? (
        <ListSkeleton rows={6} />
      ) : releases.length === 0 ? (
        <EmptyState icon={<ReceiptText />} title="Nenhum lançamento nesta fatura" message="Compras no cartão aparecem aqui conforme a data e o ciclo." />
      ) : (
        <div className={cn("grid transition-opacity", navigating && "opacity-60")} aria-busy={navigating}>
          {groups.map((g) => (
            <section key={g.date} aria-label={dayHeading(g.date, language)}>
              <h3 className="border-b border-line px-3 pb-2 pt-5 text-[13px] font-semibold">
                {dayHeading(g.date, language)} <span className="font-normal text-ink-3">{formatDate(g.date)}</span>
              </h3>
              <ul>
                {g.items.map((r) => (
                  <li key={r.key}>
                    <ReleaseRow release={r} onOpen={openReleaseDetails} onToggleDone={toggleDone} showInvoicePin={false} hideSourceColumn omitSource />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, strong, hint }: { label: string; value: React.ReactNode; strong?: boolean; hint?: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className={cn("mt-1 tabular", strong ? "text-2xl font-semibold" : "text-xl font-medium")}>{value}</dd>
      {hint && <dd className="text-[11px] text-ink-3">{hint}</dd>}
    </div>
  );
}

/** Horizontal strip of nearby cycles for one-tap jumping. */
function CycleStrip({ options, current, onPick, language }: { options: InvoiceOption[]; current: ISODate | null; onPick: (d: ISODate) => void; language: ReturnType<typeof usePrefs.getState>["language"] }) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    ref.current?.querySelector<HTMLElement>("[aria-current='true']")?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [current]);
  return (
    <nav aria-label="Faturas do cartão" ref={ref} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      {options.map((o) => {
        const active = o.closeDay === current;
        return (
          <button
            key={o.closeDay}
            type="button"
            aria-current={active || undefined}
            onClick={() => onPick(o.closeDay)}
            className={cn(
              "flex shrink-0 flex-col items-start rounded-[var(--radius-lg)] border px-3 py-2 text-left transition-colors",
              active ? "border-ink bg-ink text-bg" : "border-line bg-surface hover:border-line-strong",
            )}
          >
            <span className="text-xs font-medium">{invoiceLabel(o, language)}</span>
            <span className={cn("text-[11px]", active ? "text-bg/70" : "text-ink-3")}>
              {o.settled ? "Quitada" : STATUS_LABEL[o.status]} · <Money value={o.amount} />
            </span>
          </button>
        );
      })}
    </nav>
  );
}
