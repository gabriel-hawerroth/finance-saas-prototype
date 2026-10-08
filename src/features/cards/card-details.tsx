"use client";
import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Archive, ArchiveRestore, ArrowRight, Pencil, ReceiptText, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { AuditInfo } from "@/components/shared/audit-info";
import { ErrorState, ListSkeleton } from "@/components/shared/content-state";
import { InstitutionLogo } from "@/components/shared/institution-logo";
import { Money } from "@/components/shared/money";
import { api } from "@/data/api";
import { invalidateFinancial } from "@/data/sync";
import { isApiError } from "@/domain/errors";
import type { Id } from "@/domain/types";
import { confirm } from "@/features/overlays/dialogs";
import { openOverlay } from "@/features/overlays/store";
import { useCards } from "@/features/picklists/queries";
import { cn } from "@/lib/utils";

export function openCardDetails(cardId: Id) {
  openOverlay((close) => <CardDetails cardId={cardId} onClose={close} />);
}

/** Card details (§5.7). */
function CardDetails({ cardId, onClose }: { cardId: Id; onClose: () => void }) {
  const qc = useQueryClient();
  const router = useRouter();
  const q = useCards();
  const card = q.data?.find((c) => c.id === cardId);
  if (!card) {
    return (
      <Modal open onOpenChange={(o) => !o && onClose()} title="Cartão" variant="side">
        {q.isPending ? <ListSkeleton rows={3} /> : <ErrorState onRetry={() => q.refetch()} />}
      </Modal>
    );
  }

  const go = (href: string) => () => {
    onClose();
    router.push(href);
  };

  const toggleArchive = async () => {
    const ok = await confirm(
      card.active
        ? { message: "Arquivar este cartão? Lançamentos pendentes continuam em contas a pagar.", confirmLabel: "Arquivar" }
        : { message: "Reativar este cartão?", confirmLabel: "Reativar" },
    );
    if (!ok) return;
    try {
      await api.cards.setActive(card.id, !card.active);
      toast.success(card.active ? "Cartão arquivado" : "Cartão reativado");
      void invalidateFinancial(qc);
      onClose();
    } catch {
      toast.error("Não foi possível atualizar o cartão.");
    }
  };

  const remove = async () => {
    if (!(await confirm({ message: "Excluir este cartão?", confirmLabel: "Excluir", tone: "danger" }))) return;
    try {
      await api.cards.remove(card.id);
      toast.success("Cartão excluído");
      void invalidateFinancial(qc);
      onClose();
    } catch (error) {
      if (isApiError(error, "LINKED_REGISTERS")) {
        if (!card.active) {
          toast.warning("Este cartão tem registros vinculados e não pode ser excluído.");
          return;
        }
        const ok = await confirm({ title: "Não dá para excluir", message: "Este cartão tem lançamentos vinculados. Você pode arquivá-lo: os pendentes continuam em contas a pagar.", confirmLabel: "Arquivar" });
        if (ok) {
          await api.cards.setActive(card.id, false);
          toast.success("Cartão arquivado");
          void invalidateFinancial(qc);
          onClose();
        }
      } else toast.error("Não foi possível excluir o cartão.");
    }
  };

  const rows: [string, React.ReactNode][] = [
    ["Limite", <Money key="l" value={card.cardLimit} />],
    ["Situação", card.active ? "Ativo" : <Badge key="s" tone="warning">Arquivado</Badge>],
    ["Fechamento", `Dia ${card.closeDay}`],
    ["Vencimento", `Dia ${card.invoiceDueDay}`],
    ["Conta de pagamento", card.accountName ?? "—"],
  ];

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} variant="side" title={card.displayName} description="Cartão de crédito" leading={<InstitutionLogo institutionId={card.institutionId} name={card.displayName} />}>
      <div className="grid gap-6">
        <Button variant="primary" size="lg" onClick={go(`/cartoes-de-credito/fatura/${card.id}`)}>
          <ReceiptText aria-hidden /> Ver fatura
        </Button>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt className="text-[13px] text-ink-3">{k}</dt>
              <dd className="mt-0.5">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="grid gap-1.5">
          {[
            { label: "Editar", icon: Pencil, run: go(`/cartoes-de-credito/${card.id}`) },
            { label: card.active ? "Arquivar" : "Reativar", icon: card.active ? Archive : ArchiveRestore, run: toggleArchive },
            { label: "Excluir", icon: Trash2, run: remove, danger: true },
          ].map((a) => (
            <button key={a.label} type="button" onClick={a.run} className={cn("flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-left text-sm hover:bg-surface-2", a.danger && "text-negative")}>
              <a.icon className={cn("size-[18px]", a.danger ? "text-negative" : "text-ink-3")} aria-hidden />
              <span className="flex-1">{a.label}</span>
              <ArrowRight className="size-4 text-ink-3" aria-hidden />
            </button>
          ))}
        </div>
        <AuditInfo createdAt={card.createdAt} updatedAt={card.updatedAt} />
      </div>
    </Modal>
  );
}
