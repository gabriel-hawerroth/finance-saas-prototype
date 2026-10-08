"use client";
import { AlertTriangle, CalendarRange } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal, ModalActions } from "@/components/ui/modal";
import { isAtypicalCycle, skipsMonth } from "@/domain/card-cycle";
import type { InvoiceCycleChange } from "@/domain/types";
import { ask } from "@/features/overlays/store";
import { formatDate } from "@/lib/dates";
import { invoiceLabel } from "@/lib/format";

/**
 * Simulated effects of a cycle change (§5.8). "Outside usual" comes from the server for
 * date corrections; for a card cycle change it is derived here (C10).
 */
export function askCycleChange(sim: InvoiceCycleChange, context: "card" | "correction"): Promise<boolean> {
  return ask<boolean>((answer) => {
    const atypical = (i: InvoiceCycleChange["invoices"][number]) => (context === "correction" ? Boolean(i.outsideCycleWindow) : isAtypicalCycle(i.days));
    const skipped = context === "card" && sim.invoices.some(skipsMonth);
    const anyAtypical = sim.invoices.some(atypical);
    const effect = !sim.movesReleases
      ? context === "card"
        ? "Só os vencimentos mudam."
        : "Nenhum lançamento muda de fatura."
      : sim.releasesChangingInvoice === 1
        ? "1 lançamento muda de fatura."
        : `${sim.releasesChangingInvoice} lançamentos mudam de fatura.`;
    const extra = sim.totalInvoices - sim.invoices.length;
    return (
      <Modal
        open
        onOpenChange={(o) => !o && answer(null)}
        title={context === "card" ? "Mudança de ciclo" : "Correção de datas"}
        description="Veja como ficam as próximas faturas antes de confirmar."
        size="md"
        footer={
          <ModalActions>
            <Button onClick={() => answer(null)}>Cancelar</Button>
            <Button variant="primary" onClick={() => answer(true)}>
              Confirmar
            </Button>
          </ModalActions>
        }
      >
        <ol className="grid gap-2">
          {sim.invoices.map((i) => (
            <li key={i.closeDay} className="rounded-[var(--radius-lg)] border border-line p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2 font-medium">
                  <CalendarRange className="size-4 text-ink-3" aria-hidden />
                  {invoiceLabel({ referenceMonth: i.referenceMonth, sharesReferenceMonth: false, closeDay: i.closeDay })}
                </span>
                <span className="flex gap-1.5">
                  {i.transition && <Badge tone="brand">Transição</Badge>}
                  {atypical(i) && <Badge tone="warning">Fora do usual</Badge>}
                </span>
              </div>
              <p className="mt-1 text-[13px] text-ink-2">
                {formatDate(i.firstDay)} — {formatDate(i.closeDay)} · {i.days} dias
              </p>
              <p className="text-[13px] text-ink-3">Vence {formatDate(i.dueDate)}</p>
            </li>
          ))}
        </ol>
        {extra > 0 && <p className="mt-2 text-[13px] text-ink-3">E mais {extra} faturas seguintes ajustadas.</p>}
        <div className="mt-4 grid gap-2">
          {skipped && (
            <Warn>Um mês fica sem fatura para pagar: as compras do período entram na fatura seguinte.</Warn>
          )}
          {anyAtypical && <Warn>Há ciclo com duração atípica (menos de 15 ou mais de 45 dias).</Warn>}
          <p className="rounded-[var(--radius-lg)] bg-surface-2 px-3.5 py-3 text-sm text-ink-2">{effect}</p>
        </div>
      </Modal>
    );
  }).then((v) => v === true);
}

function Warn({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex gap-2 rounded-[var(--radius-lg)] bg-warning-soft px-3.5 py-3 text-sm text-ink-2">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
      {children}
    </p>
  );
}
