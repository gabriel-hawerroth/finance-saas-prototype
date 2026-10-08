"use client";
import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarCog, CheckCircle2, Download, ListChecks, Paperclip, Pencil, Trash2, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal, ModalActions } from "@/components/ui/modal";
import { MoneyInput } from "@/components/ui/money-input";
import { OptionPicker } from "@/components/ui/option-picker";
import { EmptyState } from "@/components/shared/content-state";
import { InstitutionLogo } from "@/components/shared/institution-logo";
import { Money } from "@/components/shared/money";
import { api } from "@/data/api";
import { invalidateFinancial } from "@/data/sync";
import { ATTACHMENT_EXTENSIONS } from "@/domain/constants";
import { isApiError } from "@/domain/errors";
import { invoiceForecast, maxPaymentAllowed, totalPaid } from "@/domain/invoice";
import type { Attachment, CreditCard, Id, InvoiceCycleValues, InvoiceHasPaymentDetails, InvoicePayment, ISODate } from "@/domain/types";
import { askCycleChange } from "@/features/cards/cycle-change-dialog";
import { useInstitutions } from "@/features/institutions/queries";
import { confirm } from "@/features/overlays/dialogs";
import { openOverlay } from "@/features/overlays/store";
import { useAccounts } from "@/features/picklists/queries";
import { usePrefs } from "@/features/prefs/store";
import { accountPickerOptions } from "@/features/releases/options";
import { addDaysISO, formatDate, todayISO } from "@/lib/dates";
import { downloadAttachment, readAttachment } from "@/lib/files";
import { formatFileSize, invoiceLabel } from "@/lib/format";

export const STATUS_LABEL = { OPEN: "Aberta", FUTURE: "Futura", CLOSED: "Fechada" } as const;

/* ───────── details (§5.8b) ───────── */

type DetailsIntent = "pay" | "dates" | "payments";

export function openInvoiceDetails(values: InvoiceCycleValues, onIntent: (i: DetailsIntent) => void) {
  openOverlay((close) => (
    <InvoiceDetails
      values={values}
      onClose={close}
      onIntent={(i) => {
        close();
        onIntent(i);
      }}
    />
  ));
}

function InvoiceDetails({ values: v, onClose, onIntent }: { values: InvoiceCycleValues; onClose: () => void; onIntent: (i: DetailsIntent) => void }) {
  const forecast = invoiceForecast(v);
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} variant="side" title={`Fatura de ${invoiceLabel(v)}`} description={STATUS_LABEL[v.status]}>
      <div className="grid gap-6">
        <div>
          <p className="text-[13px] text-ink-3">Total</p>
          <p className="font-display text-5xl">
            <Money value={v.amount} />
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge tone="neutral" size="md">{STATUS_LABEL[v.status]}</Badge>
            {v.settled && <Badge tone="positive" size="md">{v.settledByDueDate ? `Quitada na fatura de ${formatDate(v.settledByDueDate)}` : "Quitada"}</Badge>}
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <Item label="Previsto"><Money value={forecast} /></Item>
          <Item label="Restante"><Money value={v.outstanding} /></Item>
          <Item label="Fechamento">
            {formatDate(v.closeDay)} {v.closeDayPinned && <Badge tone="brand">corrigido à mão</Badge>}
          </Item>
          <Item label="Vencimento">
            {formatDate(v.dueDate)} {v.dueDatePinned && <Badge tone="brand">corrigido à mão</Badge>}
          </Item>
        </dl>
        <section aria-labelledby="inv-comp">
          <h3 id="inv-comp" className="mb-2 text-[13px] font-medium text-ink-3">Composição</h3>
          <dl className="divide-y divide-line rounded-[var(--radius-lg)] border border-line text-sm">
            <Row label={v.composition.previousBalance < 0 ? "Crédito anterior" : "Saldo anterior"} value={v.composition.previousBalance} />
            <Row label="Compras à vista" value={v.composition.purchases} />
            <Row label="Parcelas" value={v.composition.installments} />
            <Row label="Total" value={v.amount} strong />
          </dl>
        </section>
        <div className="grid gap-2">
          <Button variant="primary" size="lg" disabled={!v.canPay} onClick={() => onIntent("pay")}>
            <Wallet aria-hidden /> Pagar
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button disabled={!v.canEditDates} onClick={() => onIntent("dates")}>
              <CalendarCog aria-hidden /> Corrigir datas
            </Button>
            <Button disabled={v.payments.length === 0} onClick={() => onIntent("payments")}>
              <ListChecks aria-hidden /> Ver pagamentos
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[13px] text-ink-3">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5">
      <dt className={strong ? "font-medium" : "text-ink-2"}>{label}</dt>
      <dd>
        <Money value={value} className={strong ? "font-semibold" : ""} />
      </dd>
    </div>
  );
}

/* ───────── pay / edit payment ───────── */

export function openPaymentDialog(card: CreditCard, values: InvoiceCycleValues, payment?: InvoicePayment) {
  openOverlay((close) => <PaymentDialog card={card} values={values} payment={payment} onClose={close} />);
}

function PaymentDialog({ card, values, payment, onClose }: { card: CreditCard; values: InvoiceCycleValues; payment?: InvoicePayment; onClose: () => void }) {
  const qc = useQueryClient();
  const currency = usePrefs((s) => s.currency);
  const { data: accounts = [] } = useAccounts();
  const { data: institutions = [] } = useInstitutions();
  const today = todayISO();
  const [amount, setAmount] = React.useState(payment?.paymentAmount ?? values.outstanding);
  const [account, setAccount] = React.useState(`acc-${payment?.paymentAccountId ?? card.standardPaymentAccountId}`);
  const [date, setDate] = React.useState<ISODate>(payment?.paymentDate ?? (values.dueDate > today ? today : values.dueDate));
  const [time, setTime] = React.useState(payment?.paymentHour ?? "");
  const [file, setFile] = React.useState<{ kind: "keep" } | { kind: "remove" } | { kind: "set"; file: Attachment }>({ kind: "keep" });
  const [fileError, setFileError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [showErrors, setShowErrors] = React.useState(false);
  const max = maxPaymentAllowed(values.amount, values.payments, payment?.id);
  const errors = {
    amount: amount > max + 0.004 ? `O pagamento deve ser igual ou menor ao valor da fatura (máx. ${currency} ${max.toFixed(2).replace(".", ",")}).` : undefined,
    date: !date ? "Informe a data." : date > today ? "A data não pode ser futura." : undefined,
    account: !account ? "Escolha a conta." : undefined,
  };
  const currentFileName = file.kind === "set" ? file.file.name : file.kind === "remove" ? null : payment?.attachmentName;

  const save = async () => {
    setShowErrors(true);
    if (Object.values(errors).some(Boolean)) return;
    setSaving(true);
    try {
      const dto = { paymentAccountId: Number(account.split("-")[1]), paymentAmount: amount, paymentDate: date, paymentHour: time || null };
      const saved = payment ? await api.invoices.editPayment(payment.id, dto) : await api.invoices.addPayment({ ...dto, creditCardId: card.id, closeDate: values.closeDay });
      if (file.kind !== "keep") {
        try {
          await api.invoices.setPaymentAttachment(saved.id, file.kind === "set" ? file.file : null);
        } catch {
          toast.warning("Pagamento salvo, mas houve erro no comprovante.");
        }
      }
      toast.success(payment ? "Pagamento atualizado" : "Pagamento registrado");
      void invalidateFinancial(qc);
      onClose();
    } catch {
      toast.error("Não foi possível salvar o pagamento.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={payment ? "Editar pagamento" : "Pagar fatura"}
      description={`${card.displayName} · ${invoiceLabel(values)}`}
      size="sm"
      footer={
        <ModalActions>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={save} loading={saving}>
            {saving && file.kind === "set" && file.file.size > 1.5 * 1024 * 1024 ? "Isso pode levar alguns segundos…" : "Salvar"}
          </Button>
        </ModalActions>
      }
    >
      <div className="grid gap-4">
        <Field label="Valor" htmlFor="pay-amount" error={showErrors ? errors.amount : undefined} hint={<>Restante da fatura: <Money value={values.outstanding} /></>}>
          <MoneyInput id="pay-amount" size="lg" currency={currency} value={amount} onValueChange={setAmount} autoFocus />
        </Field>
        <Field label="Conta" htmlFor="pay-acc" error={showErrors ? errors.account : undefined}>
          <OptionPicker id="pay-acc" value={account} onValueChange={setAccount} groups={[{ options: accountPickerOptions(accounts, institutions, { topOnly: true }) }]} />
        </Field>
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field label="Data" htmlFor="pay-date" error={showErrors ? errors.date : undefined}>
            <Input id="pay-date" type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Hora" htmlFor="pay-time" optional>
            <Input id="pay-time" type="time" className="w-32" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
        </div>
        <div className="grid gap-1.5">
          <span id="pay-file-label" className="text-[13px] font-medium text-ink-2">
            Comprovante <span className="font-normal text-ink-3">(opcional, até 3 MB)</span>
          </span>
          {currentFileName ? (
            <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-line px-3 py-2">
              <Paperclip className="size-4 text-ink-3" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-sm">{currentFileName}</span>
              {file.kind === "set" && <span className="text-xs text-ink-3">{formatFileSize(file.file.size)}</span>}
              <Button size="icon-xs" variant="ghost" aria-label="Remover comprovante" onClick={() => setFile(payment?.attachmentName ? { kind: "remove" } : { kind: "keep" })}>
                <Trash2 />
              </Button>
            </div>
          ) : (
            <label className="flex cursor-pointer items-center gap-2 rounded-[var(--radius-md)] border border-dashed border-line-strong px-3 py-2.5 text-sm text-ink-2 hover:bg-surface-2 focus-within:outline focus-within:outline-2 focus-within:outline-focus">
              <Paperclip className="size-4" aria-hidden /> Escolher arquivo
              <input
                type="file"
                className="sr-only"
                aria-labelledby="pay-file-label"
                accept=".pdf,.jpg,.jpeg,.png,.jfif,.webp"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  const r = await readAttachment(f, ATTACHMENT_EXTENSIONS);
                  if (r.ok) {
                    setFile({ kind: "set", file: r.file });
                    setFileError(null);
                  } else setFileError(r.error);
                }}
              />
            </label>
          )}
          {fileError && <p role="alert" className="text-[13px] text-negative">{fileError}</p>}
          {file.kind === "set" && file.file.size > 1.5 * 1024 * 1024 && <p className="text-[13px] text-ink-3">Arquivo grande: o envio pode levar alguns segundos.</p>}
        </div>
      </div>
    </Modal>
  );
}

/* ───────── payments list ───────── */

export function openPaymentsList(card: CreditCard, values: InvoiceCycleValues) {
  openOverlay((close) => <PaymentsList card={card} values={values} onClose={close} />);
}

function PaymentsList({ card, values, onClose }: { card: CreditCard; values: InvoiceCycleValues; onClose: () => void }) {
  const qc = useQueryClient();
  const total = totalPaid(values.payments);
  const remove = async (p: InvoicePayment) => {
    if (!(await confirm({ message: "Excluir este pagamento?", confirmLabel: "Excluir", tone: "danger" }))) return;
    try {
      await api.invoices.deletePayment(p.id);
      toast.success("Pagamento excluído");
      void invalidateFinancial(qc);
      onClose();
    } catch {
      toast.error("Não foi possível excluir o pagamento.");
    }
  };
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title="Pagamentos"
      description={`Fatura de ${invoiceLabel(values)}`}
      size="md"
      footer={
        values.canPay ? (
          <ModalActions>
            <Button
              variant="primary"
              onClick={() => {
                onClose();
                openPaymentDialog(card, values);
              }}
            >
              Pagar restante
            </Button>
          </ModalActions>
        ) : undefined
      }
    >
      <div className="grid gap-4">
        <dl className="grid grid-cols-2 gap-3 rounded-[var(--radius-lg)] bg-surface-2 p-4 text-sm">
          <div>
            <dt className="text-ink-3">Total pago</dt>
            <dd className="text-lg font-semibold"><Money value={total} /></dd>
          </div>
          <div>
            <dt className="text-ink-3">Restante</dt>
            <dd className="text-lg font-semibold">
              {values.settled ? (
                <span className="inline-flex items-center gap-1 text-positive">
                  <CheckCircle2 className="size-4" aria-hidden /> Quitada
                </span>
              ) : (
                <Money value={values.outstanding} />
              )}
            </dd>
          </div>
        </dl>
        {values.payments.length === 0 ? (
          <EmptyState compact title="Nenhum pagamento nesta fatura" />
        ) : (
          <ul className="divide-y divide-line rounded-[var(--radius-lg)] border border-line">
            {values.payments.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-3 py-3">
                <InstitutionLogo institutionId={p.paymentAccountInstitutionId} name={p.paymentAccountName} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.paymentAccountName}</p>
                  <p className="text-xs text-ink-3">
                    {formatDate(p.paymentDate)}
                    {p.paymentHour ? ` às ${p.paymentHour}` : ""}
                  </p>
                </div>
                <Money value={p.paymentAmount} className="text-sm font-semibold" />
                <div className="flex">
                  {p.attachmentName && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Baixar comprovante"
                      onClick={async () => {
                        const att = await api.invoices.paymentAttachment(p.id).catch(() => null);
                        if (!att || !downloadAttachment(att)) toast.warning("Comprovante não encontrado.");
                      }}
                    >
                      <Download />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Editar pagamento"
                    onClick={() => {
                      onClose();
                      openPaymentDialog(card, values, p);
                    }}
                  >
                    <Pencil />
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label="Excluir pagamento" onClick={() => remove(p)}>
                    <Trash2 />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}

/* ───────── date correction ───────── */

export function openDateCorrection(values: InvoiceCycleValues, onDone: (closeDate: ISODate) => void) {
  openOverlay((close) => <DateCorrection values={values} onClose={close} onDone={onDone} />);
}

function DateCorrection({ values, onClose, onDone }: { values: InvoiceCycleValues; onClose: () => void; onDone: (closeDate: ISODate) => void }) {
  const qc = useQueryClient();
  const [closeDay, setCloseDay] = React.useState(values.closeDay);
  const [dueDate, setDueDate] = React.useState(values.dueDate);
  const [saving, setSaving] = React.useState(false);
  const minClose = addDaysISO(values.previousCloseDate, 1);
  const maxClose = addDaysISO(values.nextCloseDate, -1);
  const errors = {
    close: !closeDay ? "Informe o fechamento." : closeDay < minClose || closeDay > maxClose ? `Entre ${formatDate(minClose)} e ${formatDate(maxClose)}.` : undefined,
    due: !dueDate ? "Informe o vencimento." : dueDate < closeDay ? "O vencimento não pode ser antes do fechamento." : undefined,
  };

  const save = async () => {
    if (errors.close || errors.due) return;
    const change: { closeDay?: ISODate; dueDate?: ISODate } = {};
    if (closeDay !== values.closeDay) change.closeDay = closeDay;
    if (dueDate !== values.dueDate) change.dueDate = dueDate;
    if (!change.closeDay && !change.dueDate) {
      onClose();
      return;
    }
    const invoiceId = values.invoiceId as Id;
    setSaving(true);
    try {
      if (change.closeDay) {
        try {
          const sim = await api.invoices.simulateDateChange(invoiceId, change);
          if (!(await askCycleChange(sim, "correction"))) return;
        } catch {
          toast.error("Não foi possível simular a correção.");
          return;
        }
      }
      let result: { closeDate: ISODate };
      try {
        result = await api.invoices.updateDates(invoiceId, change);
      } catch (error) {
        if (!isApiError(error, "INVOICE_HAS_PAYMENT")) throw error;
        const d = error.details as InvoiceHasPaymentDetails;
        const who = d.thisInvoice && d.nextInvoice ? `esta fatura e a fatura de ${d.nextReferenceMonth}` : d.thisInvoice ? "esta fatura" : `a fatura de ${d.nextReferenceMonth}`;
        const ok = await confirm({ title: "Fatura com pagamento", message: `Já existe pagamento em ${who}. Corrigir o fechamento pode mudar valores já pagos. Continuar?`, confirmLabel: "Continuar" });
        if (!ok) return;
        result = await api.invoices.updateDates(invoiceId, change, true);
      }
      toast.success("Datas corrigidas");
      void invalidateFinancial(qc);
      onClose();
      onDone(result.closeDate);
    } catch {
      toast.error("Não foi possível corrigir as datas.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title="Corrigir datas"
      description={`Fatura de ${invoiceLabel(values)} · início em ${formatDate(values.firstDay)} (não editável)`}
      size="sm"
      footer={
        <ModalActions>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={save} loading={saving}>
            Salvar
          </Button>
        </ModalActions>
      }
    >
      <div className="grid gap-4">
        <Field label="Fechamento" htmlFor="dc-close" error={errors.close}>
          <Input id="dc-close" type="date" min={minClose} max={maxClose} value={closeDay} onChange={(e) => setCloseDay(e.target.value)} />
        </Field>
        <Field label="Vencimento" htmlFor="dc-due" error={errors.due}>
          <Input id="dc-due" type="date" min={closeDay} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
