"use client";
import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, CalendarClock, Copy, CreditCard, Download, FileText, HandCoins, Pencil, ReceiptText, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Switch } from "@/components/ui/switch";
import { AuditInfo } from "@/components/shared/audit-info";
import { CategoryIcon } from "@/components/shared/category-icon";
import { Money } from "@/components/shared/money";
import { api } from "@/data/api";
import { invalidateFinancial } from "@/data/sync";
import { releaseTitle } from "@/domain/cash-flow";
import { ERROR_MESSAGES, isApiError } from "@/domain/errors";
import type { InvoiceResolution, MonthlyRelease, PaidInvoiceConflictDetails, SeriesScope } from "@/domain/types";
import { chooseSeriesScope, confirm } from "@/features/overlays/dialogs";
import { openOverlay } from "@/features/overlays/store";
import { downloadAttachment } from "@/lib/files";
import { formatDate, formatDayMonth, monthLabel, referenceToMonthKey } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { openMoveInvoice } from "./move-invoice-dialog";
import { askPaidInvoice } from "./paid-invoice-dialog";
import { openReleaseForm } from "./release-form";

export function openReleaseDetails(release: MonthlyRelease) {
  if (release.kind === "INVOICE_PAYMENT") {
    openOverlay((close) => <InvoicePaymentDetails release={release} onClose={close} />);
    return;
  }
  openOverlay((close) => <ReleaseDetails initial={release} onClose={close} />);
}

function invoiceRef(r: MonthlyRelease): string | null {
  if (!r.invoiceMonthYear) return null;
  const base = monthLabel(referenceToMonthKey(r.invoiceMonthYear));
  return r.sharesReferenceMonth && r.invoiceCloseDay ? `${base} · fecha ${formatDayMonth(r.invoiceCloseDay)}` : base;
}

function typeLabel(r: MonthlyRelease) {
  if (r.reimbursedReleaseId) return "Reembolso";
  return r.type === "E" ? "Despesa" : r.type === "R" ? "Receita" : "Transferência";
}

async function downloadReleaseAttachment(id: number) {
  try {
    const att = await api.releases.attachment(id);
    if (!att || !downloadAttachment(att)) toast.warning("Anexo não encontrado.");
  } catch {
    toast.error("Não foi possível baixar o anexo.");
  }
}

function ReleaseDetails({ initial, onClose }: { initial: MonthlyRelease; onClose: () => void }) {
  const qc = useQueryClient();
  const [r, setR] = React.useState(initial);
  const [deleting, setDeleting] = React.useState(false);
  const toggleTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const title = releaseTitle(r);
  const subtitle =
    r.type === "T"
      ? `de ${r.account?.name ?? "—"} para ${r.targetAccount?.name ?? "—"}`
      : [r.category?.name !== title ? r.category?.name : null, r.card?.name ?? r.account?.name].filter(Boolean).join(" · ");

  const toggleDone = (next: boolean) => {
    setR((x) => ({ ...x, done: next }));
    if (toggleTimer.current) clearTimeout(toggleTimer.current);
    toggleTimer.current = setTimeout(async () => {
      const run = async (resolution?: InvoiceResolution): Promise<boolean> => {
        try {
          await api.releases.updateDone(r.id, next, resolution);
          return true;
        } catch (error) {
          if (isApiError(error, "PAID_INVOICE")) {
            const a = await askPaidInvoice(error.details as PaidInvoiceConflictDetails);
            return a ? run(a) : false;
          }
          if (isApiError(error) && error.code) toast.warning(ERROR_MESSAGES[error.code]);
          else toast.error("Não foi possível atualizar o lançamento.");
          return false;
        }
      };
      if (!(await run())) setR((x) => ({ ...x, done: !next }));
      void invalidateFinancial(qc);
    }, 400);
  };

  const remove = async () => {
    let scope: SeriesScope = "UNNECESSARY";
    if (r.isDuplicatedRelease) {
      const s = await chooseSeriesScope("delete");
      if (!s) return;
      scope = s;
    } else if (!(await confirm({ message: "Excluir este lançamento? Essa ação não pode ser desfeita.", confirmLabel: "Excluir", tone: "danger" }))) {
      return;
    }
    setDeleting(true);
    const run = async (resolution?: InvoiceResolution): Promise<boolean> => {
      try {
        await api.releases.remove(r.id, scope, resolution);
        return true;
      } catch (error) {
        if (isApiError(error, "PAID_INVOICE")) {
          const a = await askPaidInvoice(error.details as PaidInvoiceConflictDetails);
          return a ? run(a) : false;
        }
        if (isApiError(error, "EXPENSE_HAS_REIMBURSEMENTS")) toast.warning("Esta despesa tem reembolsos. Exclua os reembolsos antes.");
        else toast.error("Não foi possível excluir o lançamento.");
        return false;
      }
    };
    if (await run()) {
      toast.success("Lançamento excluído");
      void invalidateFinancial(qc);
      onClose();
    }
    setDeleting(false);
  };

  const edit = () => {
    onClose();
    openReleaseForm({ mode: "edit", type: r.type, release: r });
  };
  const duplicate = () => {
    onClose();
    openReleaseForm({ mode: "duplicate", type: r.type, release: r });
  };
  const reimburse = () => {
    onClose();
    openReleaseForm({ mode: "reimburse", type: "R", release: r });
  };

  const isAdjustment = r.balanceAdjustment;
  const amountTone = r.type === "E" ? "text-negative" : r.type === "R" ? "text-positive" : "text-transfer";

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      variant="side"
      title={title}
      description={subtitle || typeLabel(r)}
      leading={
        isAdjustment ? (
          <span className="grid size-10 shrink-0 place-items-center rounded-[11px] bg-surface-2 text-ink-2">
            <CalendarClock className="size-[18px]" aria-hidden />
          </span>
        ) : r.category ? (
          <CategoryIcon icon={r.category.icon} color={r.category.color} />
        ) : (
          <CategoryIcon icon={r.type === "T" ? "ArrowLeftRight" : "HandCoins"} color={r.type === "T" ? "var(--transfer)" : "var(--positive)"} />
        )
      }
      footer={
        <div className="flex flex-wrap items-center gap-2">
          {!isAdjustment && (
            <Button variant="primary" onClick={edit}>
              <Pencil aria-hidden /> Editar
            </Button>
          )}
          {!r.reimbursedReleaseId && (
            <Button onClick={duplicate}>
              <Copy aria-hidden /> Duplicar
            </Button>
          )}
          <Button variant="danger-ghost" className="ml-auto" onClick={remove} loading={deleting}>
            {!deleting && <Trash2 aria-hidden />} Excluir
          </Button>
        </div>
      }
    >
      <div className="grid gap-6">
        <div>
          <p className="text-[13px] font-medium text-ink-3">{typeLabel(r)}</p>
          <p className={cn("font-display text-5xl leading-tight", amountTone)}>
            <Money value={r.type === "E" ? -r.amount : r.amount} signed={r.type !== "E"} />
          </p>
          {r.reimbursedAmount > 0 && (
            <p className="mt-1 text-sm text-ink-2">
              reembolsado <Money value={r.reimbursedAmount} className="font-medium" /> · seu gasto <Money value={r.netAmount} className="font-medium" />
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 rounded-[var(--radius-lg)] bg-surface-2 px-4 py-3">
          <label htmlFor="rd-done" className="text-sm font-medium">
            {r.done ? "Realizado" : "Pendente"}
          </label>
          <Switch id="rd-done" checked={r.done} onCheckedChange={toggleDone} />
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
          {r.purchaseDate && <DetailItem label="Compra em">{formatDate(r.purchaseDate)}</DetailItem>}
          <DetailItem label={r.installmentNumber ? "Parcela em" : "Data"}>
            {formatDate(r.date)}
            {r.time ? ` às ${r.time}` : ""}
          </DetailItem>
          {r.installmentNumber && (
            <DetailItem label="Parcela">
              {r.installmentNumber}/{r.totalInstallments}
            </DetailItem>
          )}
          {r.type === "T" ? (
            <>
              <DetailItem label="Origem">
                {r.account?.name} {r.account && !r.account.active && <Badge tone="warning">Arquivada</Badge>}
              </DetailItem>
              <DetailItem label="Destino">
                {r.targetAccount?.name} {r.targetAccount && !r.targetAccount.active && <Badge tone="warning">Arquivada</Badge>}
              </DetailItem>
            </>
          ) : (
            <DetailItem label={r.card ? "Cartão" : "Conta"}>
              <span className="inline-flex items-center gap-1.5">
                {r.card && <CreditCard className="size-3.5 text-ink-3" aria-hidden />}
                {r.card?.name ?? r.account?.name ?? "—"}
              </span>{" "}
              {(r.card ?? r.account) && !(r.card ?? r.account)!.active && <Badge tone="warning">{r.card ? "Arquivado" : "Arquivada"}</Badge>}
            </DetailItem>
          )}
          {r.category && (
            <DetailItem label="Categoria">
              {r.category.name}
              {r.subcategory ? ` › ${r.subcategory.name}` : ""}
            </DetailItem>
          )}
          {r.card && invoiceRef(r) && (
            <DetailItem label="Fatura">
              {invoiceRef(r)} {r.invoicePinned && <Badge tone="brand">movida à mão</Badge>}
            </DetailItem>
          )}
        </dl>

        <div className="flex flex-wrap gap-1.5">
          {!r.countsInCashFlow && r.type !== "T" && <Badge tone="outline" size="md">Fora do fluxo de caixa</Badge>}
          {r.isDuplicatedRelease && !r.installmentNumber && <Badge tone="outline" size="md">Repetição fixa</Badge>}
          {isAdjustment && <Badge tone="outline" size="md">Ajuste de saldo · não entra nos números do mês</Badge>}
        </div>

        {r.reimbursements.length > 0 && (
          <section aria-labelledby="rd-reimb">
            <h3 id="rd-reimb" className="mb-2 text-[13px] font-medium text-ink-3">
              Reembolsos
            </h3>
            <ul className="divide-y divide-line rounded-[var(--radius-lg)] border border-line">
              {r.reimbursements.map((x) => (
                <li key={x.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                  <span>{formatDate(x.date)}</span>
                  <span className="flex items-center gap-2">
                    {!x.done && <Badge tone="warning">A receber</Badge>}
                    <Money value={x.amount} tone="positive" signed />
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {r.observation && (
          <section>
            <h3 className="mb-1 text-[13px] font-medium text-ink-3">Observação</h3>
            <p className="whitespace-pre-wrap text-sm text-ink-2">{r.observation}</p>
          </section>
        )}

        <div className="grid gap-2">
          {r.canRegisterReimbursement && (
            <ActionRow icon={<HandCoins />} onClick={reimburse} label="Registrar reembolso" hint={<>Ainda dá para reembolsar <Money value={r.reimbursableAmount} /></>} />
          )}
          {r.card && !isAdjustment && (
            <ActionRow
              icon={<ReceiptText />}
              label="Trocar fatura"
              hint={r.invoicePinned ? "Fixado à mão" : "Automático pela data da compra"}
              onClick={() => {
                onClose();
                openMoveInvoice(r);
              }}
            />
          )}
          <ActionRow
            icon={r.attachmentName ? <Download /> : <FileText />}
            label={r.attachmentName ? "Baixar anexo" : "Sem anexo"}
            hint={r.attachmentName ?? undefined}
            disabled={!r.attachmentName}
            onClick={() => downloadReleaseAttachment(r.id)}
          />
        </div>

        <AuditInfo createdAt={r.createdAt} updatedAt={r.updatedAt} />
      </div>
    </Modal>
  );
}

function DetailItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[13px] text-ink-3">{label}</dt>
      <dd className="mt-0.5 text-ink">{children}</dd>
    </div>
  );
}

function ActionRow({ icon, label, hint, onClick, disabled }: { icon: React.ReactNode; label: string; hint?: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-line px-3.5 py-3 text-left transition-colors hover:bg-surface-2 disabled:opacity-50 [&>svg]:size-[18px] [&>svg]:text-ink-3"
    >
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {hint && <span className="block truncate text-xs text-ink-3">{hint}</span>}
      </span>
      {!disabled && <ArrowRight className="size-4 text-ink-3" aria-hidden />}
    </button>
  );
}

/* ───── §5.3 invoice payment details (read-only) ───── */

function InvoicePaymentDetails({ release: r, onClose }: { release: MonthlyRelease; onClose: () => void }) {
  const router = useRouter();
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      variant="side"
      title="Pagamento de fatura"
      description={r.card?.name}
      leading={<CategoryIcon icon="Receipt" color="var(--ink-2)" />}
      footer={
        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            onClick={() => {
              onClose();
              router.push(`/cartoes-de-credito/fatura/${r.card?.id}${r.invoiceId ? `?fatura=${r.invoiceId}` : ""}`);
            }}
          >
            Ir para a fatura <ArrowRight aria-hidden />
          </Button>
          {r.attachmentName && (
            <Button
              onClick={async () => {
                try {
                  const att = await api.invoices.paymentAttachment(r.id);
                  if (!att || !downloadAttachment(att)) toast.warning("Comprovante não encontrado.");
                } catch {
                  toast.error("Não foi possível baixar o comprovante.");
                }
              }}
            >
              <Download aria-hidden /> Comprovante
            </Button>
          )}
        </div>
      }
    >
      <div className="grid gap-6">
        <p className="font-display text-5xl text-negative">
          <Money value={-r.amount} />
        </p>
        <Badge tone="positive" size="md" className="w-fit">
          Realizado
        </Badge>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <DetailItem label="Fatura paga">{invoiceRef(r) ?? "—"}</DetailItem>
          <DetailItem label="Conta de pagamento">{r.account?.name ?? "—"}</DetailItem>
          <DetailItem label="Data">{formatDate(r.date)}</DetailItem>
          <DetailItem label="Hora">{r.time ?? "--:--"}</DetailItem>
        </dl>
        <p className="text-[13px] text-ink-3">Pagamentos de fatura são editados ou excluídos na tela da fatura.</p>
      </div>
    </Modal>
  );
}
