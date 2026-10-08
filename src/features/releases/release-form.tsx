"use client";
import * as React from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { AlertTriangle, ArrowDownLeft, ArrowLeftRight, ArrowUpRight, ChevronDown, Info, Paperclip, Repeat, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, describedBy } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { MoneyInput } from "@/components/ui/money-input";
import { OptionPicker, type PickerGroup } from "@/components/ui/option-picker";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { Switch, SwitchRow } from "@/components/ui/switch";
import { AuditInfo } from "@/components/shared/audit-info";
import { Money } from "@/components/shared/money";
import { api } from "@/data/api";
import { invalidateFinancial } from "@/data/sync";
import { ATTACHMENT_EXTENSIONS, FIXED_BY_OPTIONS } from "@/domain/constants";
import { ERROR_MESSAGES, isApiError } from "@/domain/errors";
import { defaultDone, defaultReleaseDate, FIXED_REPEAT_LIMITS, INSTALLMENT_LIMITS, normalizeInstallments, suggestedRepeatCount } from "@/domain/release-form";
import type { AttachmentChange, FixedBy, Id, ISODate, InvoiceResolution, MonthlyRelease, ReleaseType, SaveReleaseDTO, SeriesScope } from "@/domain/types";
import { useInstitutions } from "@/features/institutions/queries";
import { confirm, chooseSeriesScope } from "@/features/overlays/dialogs";
import { openOverlay } from "@/features/overlays/store";
import { usePicklists } from "@/features/picklists/queries";
import { usePrefs } from "@/features/prefs/store";
import { formatFileSize } from "@/lib/format";
import { readAttachment } from "@/lib/files";
import { cn } from "@/lib/utils";
import { useReleaseContext } from "./context";
import { accountPickerOptions, cardPickerOptions, categoryPickerGroups, parseRef, resolveCategoryKey } from "./options";
import { askPaidInvoice } from "./paid-invoice-dialog";

export interface ReleasePreset {
  amount?: number;
  accountId?: Id;
  cardId?: Id;
  targetAccountId?: Id;
  categoryId?: Id | null;
  subcategoryId?: Id | null;
  description?: string;
  outOfFlow?: boolean;
  date?: ISODate;
}

export interface ReleaseFormInput {
  mode: "new" | "edit" | "duplicate" | "reimburse";
  type: ReleaseType;
  /** edit/duplicate: the release itself; reimburse: the expense being reimbursed. */
  release?: MonthlyRelease;
  preset?: ReleasePreset;
  /** Custom title (account shortcuts like "Guardar"). */
  title?: string;
  note?: React.ReactNode;
}

export function openReleaseForm(input: ReleaseFormInput) {
  openOverlay((close) => <ReleaseFormDialog input={input} onClose={close} />);
}

const TYPE_META: Record<ReleaseType, { noun: string; icon: React.ElementType; tone: string; verb: string }> = {
  E: { noun: "Despesa", icon: ArrowUpRight, tone: "text-negative bg-negative-soft", verb: "despesa" },
  R: { noun: "Receita", icon: ArrowDownLeft, tone: "text-positive bg-positive-soft", verb: "receita" },
  T: { noun: "Transferência", icon: ArrowLeftRight, tone: "text-transfer bg-transfer-soft", verb: "transferência" },
};

const FIXED_VALUES = ["DAILY", "WEEKLY", "MONTHLY", "BIMONTHLY", "QUARTERLY", "BIANNUAL", "ANNUAL"] as const;

function makeSchema(type: ReleaseType, isReimbursement: boolean) {
  return z
    .object({
      amount: z.number(),
      description: z.string().max(50, "Use no máximo 50 caracteres."),
      source: z.string().min(1, type === "T" ? "Escolha a conta de origem." : "Escolha a conta ou o cartão."),
      target: z.string(),
      category: z.string(),
      date: z.string().min(1, "Informe a data."),
      installmentDate: z.string(),
      time: z.string(),
      done: z.boolean(),
      repeatOn: z.boolean(),
      repeat: z.enum(["FIXED", "INSTALLMENTS"]),
      fixedBy: z.enum(FIXED_VALUES),
      repeatFor: z.number(),
      observation: z.string().max(100, "Use no máximo 100 caracteres."),
      outOfFlow: z.boolean(),
    })
    .superRefine((v, ctx) => {
      if (!(v.amount > 0)) ctx.addIssue({ code: "custom", path: ["amount"], message: "Informe um valor maior que zero." });
      if (type === "T") {
        if (!v.target) ctx.addIssue({ code: "custom", path: ["target"], message: "Escolha a conta de destino." });
        else if (v.target === v.source) ctx.addIssue({ code: "custom", path: ["target"], message: "A conta de destino deve ser diferente da origem." });
      } else if (!isReimbursement && !v.category) {
        ctx.addIssue({ code: "custom", path: ["category"], message: "Escolha uma categoria." });
      }
      if (v.repeatOn) {
        const lim = v.repeat === "INSTALLMENTS" ? INSTALLMENT_LIMITS : FIXED_REPEAT_LIMITS;
        if (!Number.isFinite(v.repeatFor) || v.repeatFor < lim.min || v.repeatFor > lim.max) {
          ctx.addIssue({ code: "custom", path: ["repeatFor"], message: `Entre ${lim.min} e ${lim.max}.` });
        }
      }
    });
}

type FormValues = z.infer<ReturnType<typeof makeSchema>>;

function ReleaseFormDialog({ input, onClose }: { input: ReleaseFormInput; onClose: () => void }) {
  const qc = useQueryClient();
  const { accounts, cards, categories } = usePicklists();
  const { data: institutions = [] } = useInstitutions();
  const currency = usePrefs((s) => s.currency);
  const ctx = useReleaseContext.getState();
  const { mode, release } = input;
  const isReimbursement = mode === "reimburse" || (mode === "edit" && release?.reimbursedReleaseId != null);
  const type: ReleaseType = isReimbursement ? "R" : input.type;
  const meta = TYPE_META[type];
  const isInstallmentEdit = mode === "edit" && release?.installmentNumber != null;
  const isFixedSeriesEdit = mode === "edit" && release?.isDuplicatedRelease && !release.installmentNumber;
  const parent = mode === "reimburse" ? release : undefined;

  /* ───── initial values ───── */
  const initial = React.useMemo<FormValues>(() => {
    const p = input.preset ?? {};
    const base: FormValues = {
      amount: p.amount ?? 0,
      description: p.description ?? "",
      source: "",
      target: p.targetAccountId ? `acc-${p.targetAccountId}` : "",
      category: p.subcategoryId ? `sub-${p.subcategoryId}` : p.categoryId ? `cat-${p.categoryId}` : "",
      date: p.date ?? defaultReleaseDate(ctx.monthKey),
      installmentDate: "",
      time: "",
      done: true,
      repeatOn: false,
      repeat: "FIXED",
      fixedBy: "MONTHLY",
      repeatFor: 12,
      observation: "",
      outOfFlow: p.outOfFlow ?? false,
    };
    if (mode === "new") {
      if (p.cardId && type === "E") base.source = `card-${p.cardId}`;
      else if (p.accountId) base.source = `acc-${p.accountId}`;
      else if (ctx.cardId && type === "E") base.source = `card-${ctx.cardId}`;
      else if (ctx.accountId) base.source = `acc-${ctx.accountId}`;
      base.done = defaultDone(base.date, null);
      return base;
    }
    if (mode === "reimburse" && parent) {
      base.amount = parent.reimbursableAmount;
      base.source = parent.account && !parent.card ? `acc-${parent.account.id}` : "";
      base.date = defaultReleaseDate(undefined);
      base.done = defaultDone(base.date, null);
      return base;
    }
    if (!release) return base;
    const dup = mode === "duplicate";
    const keepRef = <T extends { active: boolean } | null | undefined>(ref: T) => (dup && ref && !ref.active ? null : ref);
    const acc = keepRef(release.account);
    const card = keepRef(release.card);
    const target = keepRef(release.targetAccount);
    const cat = keepRef(release.category);
    const sub = keepRef(release.subcategory);
    return {
      ...base,
      amount: release.amount,
      description: release.description ?? "",
      source: card ? `card-${card.id}` : acc ? `acc-${acc.id}` : "",
      target: target ? `acc-${target.id}` : "",
      category: sub ? `sub-${sub.id}` : cat ? `cat-${cat.id}` : "",
      date: isInstallmentEdit ? release.purchaseDate ?? release.date : release.date,
      installmentDate: isInstallmentEdit ? release.date : "",
      time: release.time ?? "",
      done: release.done,
      observation: release.observation ?? "",
      outOfFlow: !release.countsInCashFlow,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const archivedCleared =
    mode === "duplicate" &&
    release != null &&
    [release.account, release.card, release.targetAccount, release.category, release.subcategory].some((r) => r && !r.active);

  const schema = React.useMemo(() => makeSchema(type, isReimbursement), [type, isReimbursement]);
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: initial, mode: "onSubmit" });
  const { control, register, handleSubmit, setValue, formState, getValues } = form;
  const errors = formState.errors;
  const [doneTouched, setDoneTouched] = React.useState(mode !== "new" && mode !== "reimburse");
  const [attachment, setAttachment] = React.useState<AttachmentChange>({ kind: "keep" });
  const [attachmentError, setAttachmentError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const hasExtras = Boolean(initial.observation || initial.outOfFlow || release?.attachmentName);
  const [moreOpen, setMoreOpen] = React.useState(hasExtras);

  const watched = useWatch({ control });
  const source = watched.source ?? "";
  const sourceRef = parseRef(source);
  const repeatOn = watched.repeatOn ?? false;
  const repeat = watched.repeat ?? "FIXED";

  // C12: "done" follows the date/repetition until the user touches it.
  React.useEffect(() => {
    if (doneTouched) return;
    setValue("done", defaultDone(watched.date ?? "", repeatOn ? repeat : null));
  }, [watched.date, repeatOn, repeat, doneTouched, setValue]);

  React.useEffect(() => {
    if (type !== "E" && repeat === "INSTALLMENTS") setValue("repeat", "FIXED");
  }, [type, repeat, setValue]);

  /* ───── options ───── */
  const sourceGroups: PickerGroup[] = React.useMemo(() => {
    const accOpts = accountPickerOptions(accounts, institutions, { ghost: mode === "edit" ? release?.account : null });
    if (type !== "E" || isReimbursement) return [{ label: undefined, options: accOpts }];
    return [
      { label: "Contas", options: accOpts },
      { label: "Cartões de crédito", options: cardPickerOptions(cards, mode === "edit" ? release?.card : null) },
    ];
  }, [accounts, cards, institutions, type, isReimbursement, mode, release]);

  const targetGroups: PickerGroup[] = React.useMemo(
    () => [{ options: accountPickerOptions(accounts, institutions, { ghost: mode === "edit" ? release?.targetAccount : null }) }],
    [accounts, institutions, mode, release],
  );

  const categoryGroups = React.useMemo(
    () => (type === "T" ? [] : categoryPickerGroups(categories, type as "E" | "R", mode === "edit" ? { category: release?.category, subcategory: release?.subcategory } : undefined)),
    [categories, type, mode, release],
  );

  const noSources = accounts.filter((a) => a.active).length === 0 && cards.filter((c) => c.active).length === 0;

  /* ───── title ───── */
  const title =
    input.title ??
    (isReimbursement ? (mode === "edit" ? "Editando reembolso" : "Registrar reembolso") : `${mode === "edit" ? "Editando" : mode === "duplicate" ? "Duplicar" : "Nova"} ${meta.noun.toLowerCase()}`);
  const prettyTitle = title;

  /* ───── submit ───── */
  const buildDTO = (v: FormValues): SaveReleaseDTO => {
    const src = parseRef(v.source)!;
    const cat = resolveCategoryKey(v.category, categories, { categoryId: release?.category?.id, subcategoryId: release?.subcategory?.id });
    const stayAccount = isInstallmentEdit && src.kind === "acc" && release?.card == null;
    return {
      type,
      description: v.description.trim() || null,
      amount: v.amount,
      accountId: src.kind === "acc" ? src.id : null,
      creditCardId: src.kind === "card" ? src.id : null,
      targetAccountId: type === "T" ? parseRef(v.target)?.id ?? null : null,
      categoryId: type === "T" || isReimbursement ? null : cat.categoryId,
      subcategoryId: type === "T" || isReimbursement ? null : cat.subcategoryId,
      date: isInstallmentEdit ? (stayAccount ? v.installmentDate : release!.date) : v.date,
      purchaseDate: isInstallmentEdit ? v.date : null,
      time: v.time || null,
      done: v.done,
      observation: v.observation.trim() || null,
      repeat: mode !== "edit" && v.repeatOn && !isReimbursement ? v.repeat : null,
      fixedBy: mode !== "edit" && v.repeatOn && v.repeat === "FIXED" ? (v.fixedBy as FixedBy) : null,
      countsInCashFlow: type === "T" ? true : !v.outOfFlow,
      reimbursedReleaseId: isReimbursement ? (mode === "reimburse" ? parent!.id : release!.reimbursedReleaseId) : null,
    };
  };

  const persistAttachment = async (id: Id) => {
    if (attachment.kind === "keep") return;
    try {
      await api.releases.setAttachment(id, attachment.kind === "set" ? attachment.file : null);
    } catch {
      toast.warning("Lançamento salvo, mas houve erro no anexo.");
    }
  };

  const onSubmit = async (v: FormValues) => {
    const dto = buildDTO(v);
    let scope: SeriesScope = "UNNECESSARY";

    if (isInstallmentEdit && release) {
      const before = release.card ? `card-${release.card.id}` : `acc-${release.account?.id}`;
      const after = v.source;
      const n = release.totalInstallments;
      if (before !== after && (before.startsWith("card") || after.startsWith("card"))) {
        const toCard = after.startsWith("card");
        const ok = await confirm({
          message: toCard
            ? n
              ? `As ${n} parcelas desta compra passarão para este cartão.`
              : "As parcelas desta compra passarão para este cartão."
            : n
              ? `As ${n} parcelas desta compra deixarão o cartão e passarão para esta conta.`
              : "As parcelas desta compra deixarão o cartão e passarão para esta conta.",
        });
        if (!ok) return;
      }
    }
    if (isFixedSeriesEdit && release) {
      const s = await chooseSeriesScope("edit");
      if (!s) return;
      if (s !== "JUST_THIS" && v.date !== release.date) {
        toast.warning("Para alterar vários lançamentos, a data deve permanecer igual.");
        return;
      }
      scope = s;
    }

    setSaving(true);
    const run = async (resolution?: InvoiceResolution): Promise<Id | null> => {
      try {
        if (mode === "edit" && release) return (await api.releases.update(release.id, dto, scope, resolution)).id;
        const repeatFor = v.repeatOn && !isReimbursement ? (v.repeat === "INSTALLMENTS" ? normalizeInstallments(v.repeatFor) : v.repeatFor) : 0;
        return (await api.releases.create(dto, repeatFor, resolution)).id;
      } catch (error) {
        if (isApiError(error, "PAID_INVOICE")) {
          const answer = await askPaidInvoice(error.details as never);
          return answer ? run(answer) : null;
        }
        if (isApiError(error) && error.code) toast.warning(ERROR_MESSAGES[error.code]);
        else toast.error("Não foi possível salvar o lançamento. Tente novamente.");
        return null;
      }
    };
    const id = await run();
    if (id != null) {
      await persistAttachment(id);
      toast.success(isReimbursement ? "Reembolso salvo" : `${meta.noun} salva`);
      void invalidateFinancial(qc);
      onClose();
    }
    setSaving(false);
  };

  const nothingChanged = mode === "edit" && !formState.isDirty && attachment.kind === "keep";
  const disableSave = saving || nothingChanged || (repeatOn && !Number.isFinite(watched.repeatFor));

  const currentAttachmentName = attachment.kind === "set" ? attachment.file.name : attachment.kind === "remove" ? null : mode === "edit" ? release?.attachmentName : null;

  /* ───── render ───── */
  const Icon = meta.icon;
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      variant="side"
      size="md"
      dismissible={!formState.isDirty}
      title={prettyTitle}
      description={input.note ? undefined : isReimbursement ? "Reembolso entra como receita e abate a despesa original." : undefined}
      leading={
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-full", meta.tone)}>
          <Icon className="size-5" aria-hidden />
        </span>
      }
      footer={
        <div className="flex items-center justify-between gap-3">
          <p className="hidden text-xs text-ink-3 sm:block">
            <kbd className="font-mono">Ctrl</kbd> + <kbd className="font-mono">Enter</kbd> para salvar
          </p>
          <div className="flex flex-1 gap-2 sm:flex-none">
            <Button className="flex-1 sm:flex-none" onClick={onClose}>
              Cancelar
            </Button>
            <Button className="flex-1 sm:flex-none" variant="primary" type="submit" form="release-form" loading={saving} disabled={disableSave}>
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </div>
      }
    >
      <form
        id="release-form"
        noValidate
        onSubmit={handleSubmit(onSubmit)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            void handleSubmit(onSubmit)();
          }
        }}
        className="grid gap-5 pt-1"
      >
        {noSources && (
          <Notice tone="warning">Você ainda não tem contas ou cartões ativos. Cadastre uma conta para registrar lançamentos.</Notice>
        )}
        {archivedCleared && <Notice tone="warning">Algumas opções do lançamento original estão arquivadas. Escolha opções ativas.</Notice>}
        {input.note && <Notice>{input.note}</Notice>}
        {isReimbursement && (parent || release?.reimbursedRelease) && (
          <Notice>
            {parent ? (
              <>
                Reembolso de <strong className="font-medium text-ink">{parent.description || parent.subcategory?.name || parent.category?.name}</strong>, que custou{" "}
                <Money value={parent.amount} className="font-medium text-ink" />. Ainda dá para reembolsar <Money value={parent.reimbursableAmount} className="font-medium text-ink" />.
              </>
            ) : (
              <>Reembolso de uma despesa em {release?.reimbursedRelease?.categoryName ?? "outra categoria"}.</>
            )}
          </Notice>
        )}
        {isInstallmentEdit && (
          <Notice>
            {release?.card
              ? "Parcela de uma compra no cartão: descrição, categoria, observação, data da compra, hora e cartão valem para todas as parcelas. Valor e realizado valem só para esta parcela. Para mudar de fatura, use “Trocar fatura”."
              : "Parcela de uma compra: descrição, categoria, observação, data da compra e hora valem para todas as parcelas. Valor, conta, data da parcela e realizado valem só para esta."}
          </Notice>
        )}

        <Field label="Valor" htmlFor="rf-amount" error={errors.amount?.message} hint={repeatOn && repeat === "INSTALLMENTS" ? "Valor de cada parcela." : undefined}>
          <Controller
            control={control}
            name="amount"
            render={({ field }) => (
              <MoneyInput
                id="rf-amount"
                size="hero"
                currency={currency}
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                autoFocus={mode === "new"}
                aria-invalid={Boolean(errors.amount)}
                aria-describedby={describedBy("rf-amount", errors.amount)}
              />
            )}
          />
        </Field>

        <Field label="Descrição" htmlFor="rf-desc" optional error={errors.description?.message} counter={{ value: (watched.description ?? "").length, max: 50 }}>
          <Input id="rf-desc" maxLength={50} placeholder={type === "E" ? "Ex.: Supermercado" : type === "R" ? "Ex.: Salário" : "Ex.: Reserva do mês"} {...register("description")} />
        </Field>

        <Field label={type === "T" ? "Conta de origem" : type === "E" && !isReimbursement ? "Conta ou cartão" : "Conta"} htmlFor="rf-source" error={errors.source?.message}>
          <Controller
            control={control}
            name="source"
            render={({ field }) => (
              <OptionPicker
                id="rf-source"
                value={field.value}
                onValueChange={field.onChange}
                groups={sourceGroups}
                placeholder="Selecione"
                searchPlaceholder="Buscar conta ou cartão"
                invalid={Boolean(errors.source)}
              />
            )}
          />
        </Field>

        {type === "T" && (
          <Field label="Conta de destino" htmlFor="rf-target" error={errors.target?.message}>
            <Controller
              control={control}
              name="target"
              render={({ field }) => <OptionPicker id="rf-target" value={field.value} onValueChange={field.onChange} groups={targetGroups} invalid={Boolean(errors.target)} />}
            />
          </Field>
        )}

        {type !== "T" &&
          (isReimbursement ? (
            <Field label="Categoria (da despesa)" htmlFor="rf-cat-ro">
              <p id="rf-cat-ro" className="rounded-[var(--radius-md)] bg-surface-2 px-3 py-2.5 text-sm text-ink-2">
                {parent?.category?.name ?? release?.reimbursedRelease?.categoryName ?? "—"}
              </p>
            </Field>
          ) : (
            <Field label="Categoria" htmlFor="rf-cat" error={errors.category?.message}>
              <Controller
                control={control}
                name="category"
                render={({ field }) => (
                  <OptionPicker id="rf-cat" value={field.value} onValueChange={field.onChange} groups={categoryGroups} searchPlaceholder="Buscar categoria" invalid={Boolean(errors.category)} />
                )}
              />
            </Field>
          ))}

        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field label={isInstallmentEdit ? "Data da compra" : "Data"} htmlFor="rf-date" error={errors.date?.message}>
            <Input id="rf-date" type="date" {...register("date")} />
          </Field>
          <Field label="Hora" htmlFor="rf-time" optional>
            <Input id="rf-time" type="time" className="w-32" {...register("time")} />
          </Field>
        </div>

        {isInstallmentEdit && release?.account && sourceRef?.kind === "acc" && (
          <Field label="Data da parcela" htmlFor="rf-idate" error={errors.installmentDate?.message}>
            <Input id="rf-idate" type="date" {...register("installmentDate", { required: true })} />
          </Field>
        )}

        <Controller
          control={control}
          name="done"
          render={({ field }) => (
            <div className="flex items-center justify-between gap-3 rounded-[var(--radius-lg)] bg-surface-2 px-4 py-3">
              <div>
                <label htmlFor="rf-done" className="text-sm font-medium text-ink">
                  {field.value ? (type === "R" ? "Recebido" : type === "T" ? "Realizada" : "Pago") : "Pendente"}
                </label>
                <p className="text-[13px] text-ink-3">{field.value ? "Já aconteceu e altera o saldo." : "Previsto: ainda não altera o saldo."}</p>
              </div>
              <Switch
                id="rf-done"
                checked={field.value}
                onCheckedChange={(c) => {
                  setDoneTouched(true);
                  field.onChange(c);
                }}
              />
            </div>
          )}
        />

        {/* Repetition: only for new, non-reimbursement releases */}
        {mode !== "edit" && !isReimbursement && (
          <div className="rounded-[var(--radius-lg)] border border-line">
            <Controller
              control={control}
              name="repeatOn"
              render={({ field }) => (
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <Repeat className="size-4 text-ink-3" aria-hidden />
                    <label htmlFor="rf-repeat" className="text-sm font-medium text-ink">
                      Repetir
                    </label>
                  </div>
                  <Switch
                    id="rf-repeat"
                    checked={field.value}
                    onCheckedChange={(c) => {
                      field.onChange(c);
                      if (!c) {
                        setValue("repeat", "FIXED");
                        setValue("fixedBy", "MONTHLY");
                        setValue("repeatFor", 12);
                      }
                    }}
                  />
                </div>
              )}
            />
            <AnimatePresence initial={false}>
              {repeatOn && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="grid gap-4 border-t border-line px-4 py-4">
                    <Controller
                      control={control}
                      name="repeat"
                      render={({ field }) => (
                        <Segmented
                          label="Tipo de repetição"
                          stretch
                          value={field.value}
                          onValueChange={(v) => {
                            field.onChange(v);
                            setValue("repeatFor", v === "INSTALLMENTS" ? 2 : suggestedRepeatCount(getValues("fixedBy") as FixedBy));
                          }}
                          options={[
                            { value: "FIXED", label: "Fixo" },
                            { value: "INSTALLMENTS", label: "Parcelado", disabled: type !== "E" },
                          ]}
                        />
                      )}
                    />
                    {repeat === "FIXED" ? (
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Periodicidade" htmlFor="rf-fixedby">
                          <Controller
                            control={control}
                            name="fixedBy"
                            render={({ field }) => (
                              <Select
                                id="rf-fixedby"
                                value={field.value}
                                onValueChange={(v) => {
                                  field.onChange(v);
                                  setValue("repeatFor", suggestedRepeatCount(v as FixedBy));
                                }}
                                options={FIXED_BY_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                              />
                            )}
                          />
                        </Field>
                        <Field
                          label={`Por quantos ${FIXED_BY_OPTIONS.find((o) => o.value === watched.fixedBy)?.unit[1] ?? "períodos"}`}
                          htmlFor="rf-count"
                          error={errors.repeatFor?.message}
                        >
                          <Input id="rf-count" type="number" inputMode="numeric" min={2} max={365} {...register("repeatFor", { valueAsNumber: true })} />
                        </Field>
                      </div>
                    ) : (
                      <Field label="Em quantos meses" htmlFor="rf-inst" error={errors.repeatFor?.message} hint={watched.amount && watched.repeatFor ? <>Total da compra: <Money value={(watched.amount ?? 0) * (watched.repeatFor ?? 0)} /></> : undefined}>
                        <Input
                          id="rf-inst"
                          type="number"
                          inputMode="numeric"
                          min={2}
                          max={199}
                          {...register("repeatFor", {
                            valueAsNumber: true,
                            onBlur: (e) => setValue("repeatFor", normalizeInstallments(Number(e.target.value))),
                          })}
                        />
                      </Field>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Progressive disclosure: less frequent options */}
        <div>
          <button
            type="button"
            onClick={() => setMoreOpen((o) => !o)}
            aria-expanded={moreOpen}
            aria-controls="rf-more"
            className="flex w-full items-center justify-between rounded-[var(--radius-md)] py-1 text-sm font-medium text-ink-2 hover:text-ink"
          >
            Mais opções
            <ChevronDown className={cn("size-4 transition-transform", moreOpen && "rotate-180")} aria-hidden />
          </button>
          <div id="rf-more" hidden={!moreOpen} className="mt-3 grid gap-4">
            <Field label="Observação" htmlFor="rf-obs" optional error={errors.observation?.message} counter={{ value: (watched.observation ?? "").length, max: 100 }}>
              <Textarea id="rf-obs" rows={2} maxLength={100} {...register("observation")} />
            </Field>

            <div className="grid gap-1.5">
              <span className="text-[13px] font-medium text-ink-2" id="rf-att-label">
                Anexo <span className="font-normal text-ink-3">(PDF ou imagem, até 3 MB)</span>
              </span>
              {currentAttachmentName ? (
                <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-line px-3 py-2">
                  <Paperclip className="size-4 text-ink-3" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-sm">{currentAttachmentName}</span>
                  {attachment.kind === "set" && <span className="text-xs text-ink-3">{formatFileSize(attachment.file.size)}</span>}
                  <Button size="icon-xs" variant="ghost" aria-label="Remover anexo" onClick={() => setAttachment(mode === "edit" && release?.attachmentName ? { kind: "remove" } : { kind: "keep" })}>
                    <Trash2 />
                  </Button>
                </div>
              ) : (
                <label className="flex cursor-pointer items-center gap-2 rounded-[var(--radius-md)] border border-dashed border-line-strong px-3 py-2.5 text-sm text-ink-2 transition-colors hover:border-ink-3 hover:bg-surface-2 focus-within:outline focus-within:outline-2 focus-within:outline-focus">
                  <Paperclip className="size-4" aria-hidden />
                  Escolher arquivo
                  <input
                    type="file"
                    className="sr-only"
                    aria-labelledby="rf-att-label"
                    accept=".pdf,.jpg,.jpeg,.png,.jfif,.webp"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (!f) return;
                      const r = await readAttachment(f, ATTACHMENT_EXTENSIONS);
                      if (r.ok) {
                        setAttachment({ kind: "set", file: r.file });
                        setAttachmentError(null);
                      } else setAttachmentError(r.error);
                    }}
                  />
                </label>
              )}
              {attachmentError && (
                <p role="alert" className="text-[13px] text-negative">
                  {attachmentError}
                </p>
              )}
            </div>

            {type !== "T" && (
              <Controller
                control={control}
                name="outOfFlow"
                render={({ field }) => (
                  <SwitchRow
                    id="rf-outflow"
                    label="Fora do fluxo de caixa"
                    hint="Muda o saldo, mas fica fora dos totais e relatórios do mês."
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            )}
          </div>
        </div>

        {mode === "edit" && release && <AuditInfo createdAt={release.createdAt} updatedAt={release.updatedAt} />}
      </form>
    </Modal>
  );
}

function Notice({ children, tone = "info" }: { children: React.ReactNode; tone?: "info" | "warning" }) {
  return (
    <div className={cn("flex gap-2.5 rounded-[var(--radius-lg)] px-3.5 py-3 text-[13px] leading-relaxed", tone === "warning" ? "bg-warning-soft text-ink-2" : "bg-surface-2 text-ink-2")}>
      {tone === "warning" ? <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden /> : <Info className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden />}
      <div>{children}</div>
    </div>
  );
}

export { Notice };
