"use client";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/shared/money";
import { ask } from "@/features/overlays/store";
import { formatDate } from "@/lib/dates";
import type { InvoiceResolution, PaidInvoiceConflictDetails } from "@/domain/types";

/** "Fatura já paga" (§5.17). One answer applies to every affected invoice. */
export function askPaidInvoice(details: PaidInvoiceConflictDetails): Promise<InvoiceResolution | null> {
  return ask<InvoiceResolution>((answer) => {
    const many = details.invoices.length > 1;
    const single = details.invoices[0];
    const keepLabel = !details.canMove ? "Continuar mesmo assim" : many ? "Manter nas faturas" : `Manter em ${single.label}`;
    const moveLabel = details.target ? `Mover para ${details.target.label}` : "Mover para a próxima";
    return (
      <Modal
        open
        onOpenChange={(o) => !o && answer(null)}
        title={many ? `${details.invoices.length} faturas já pagas` : "Fatura já paga"}
        size="md"
        leading={
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-warning-soft text-warning">
            <AlertTriangle className="size-5" aria-hidden />
          </span>
        }
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button onClick={() => answer(null)}>Cancelar</Button>
            <Button variant={details.canMove ? "secondary" : "primary"} onClick={() => answer("KEEP")}>
              {keepLabel}
            </Button>
            {details.canMove && (
              <Button variant="primary" onClick={() => answer("MOVE_TO_OPEN")} autoFocus>
                {moveLabel}
              </Button>
            )}
          </div>
        }
      >
        <p className="text-[15px] leading-relaxed text-ink-2">
          {details.canMove
            ? "Esta alteração acrescenta valor a uma fatura que já foi paga. Você pode manter o lançamento nela (ficará um valor em aberto) ou movê-lo para a fatura aberta, mantendo a data original."
            : "Esta alteração tira valor de uma fatura que já foi paga. O valor pago a mais vira crédito."}
          {!many && single && (
            <>
              {" "}
              O lançamento é de {formatDate(details.releaseDate)} e a fatura {single.settledByLater ? "foi quitada por uma fatura posterior" : single.lastPaymentDate ? `foi paga em ${formatDate(single.lastPaymentDate)}` : "está quitada"}.
            </>
          )}
        </p>
        <ul className="mt-4 grid gap-2">
          {details.invoices.map((inv) => (
            <li key={inv.closeDay} className="rounded-[var(--radius-lg)] border border-line p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-ink">Fatura de {inv.label}</span>
                <Badge tone={inv.entering ? "warning" : "positive"}>{inv.entering ? "acrescenta valor" : "reduz valor"}</Badge>
              </div>
              <p className="mt-1 text-[13px] text-ink-3">
                Vence {formatDate(inv.dueDate)} · {inv.settledByLater ? "quitada por fatura posterior" : inv.lastPaymentDate ? `paga em ${formatDate(inv.lastPaymentDate)}` : "quitada"}
              </p>
              <p className="mt-1 text-[13px] text-ink-2">
                {inv.outstandingAfter >= 0 ? (
                  <>
                    Fica <Money value={inv.outstandingAfter} className="font-medium" /> em aberto
                  </>
                ) : (
                  <>
                    Fica com <Money value={-inv.outstandingAfter} className="font-medium" /> de crédito
                  </>
                )}
              </p>
            </li>
          ))}
        </ul>
      </Modal>
    );
  });
}
