"use client";
import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Search, CreditCard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { MoneyInput } from "@/components/ui/money-input";
import { OptionPicker } from "@/components/ui/option-picker";
import { Select } from "@/components/ui/select";
import { InstitutionLogo } from "@/components/shared/institution-logo";
import { api } from "@/data/api";
import { invalidateFinancial } from "@/data/sync";
import { isUnusualGap, suggestCloseDay } from "@/domain/card-cycle";
import type { Institution } from "@/domain/types";
import { useInstitutions } from "@/features/institutions/queries";
import { openOverlay } from "@/features/overlays/store";
import { useAccounts } from "@/features/picklists/queries";
import { usePrefs } from "@/features/prefs/store";
import { accountPickerOptions } from "@/features/releases/options";
import { normalize } from "@/lib/text";

export function openNewCardWizard() {
  openOverlay((close) => <NewCardWizard onClose={close} />);
}

export const DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: `Dia ${i + 1}` }));

/** Two-step card creation with smart suggestions (§5.6). */
function NewCardWizard({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const currency = usePrefs((s) => s.currency);
  const { data: institutions = [] } = useInstitutions();
  const { data: accounts = [] } = useAccounts();
  const [step, setStep] = React.useState<1 | 2>(1);
  const [query, setQuery] = React.useState("");
  const [bank, setBank] = React.useState<Institution | null>(null);
  const [name, setName] = React.useState("");
  const [limit, setLimit] = React.useState(0);
  const [closeDay, setCloseDay] = React.useState(1);
  const [dueDay, setDueDay] = React.useState(1);
  const [closeChosen, setCloseChosen] = React.useState(false);
  const [daysTouched, setDaysTouched] = React.useState(false);
  const [account, setAccount] = React.useState("");
  const [accountSuggested, setAccountSuggested] = React.useState(false);
  const [showErrors, setShowErrors] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const list = institutions.filter((i) => i.category !== "WALLET" && normalize(i.name).includes(normalize(query)));

  const chooseBank = (b: Institution | null) => {
    setBank(b);
    const suggestion = b ? accounts.find((a) => a.active && a.primaryAccountId == null && a.type === "CHECKING" && a.institutionId === b.id) : undefined;
    if (suggestion) {
      setAccount(`acc-${suggestion.id}`);
      setAccountSuggested(true);
    }
    setStep(2);
  };

  const errors = {
    name: !bank && !name.trim() ? "Informe um nome (o cartão não tem banco)." : undefined,
    limit: !(limit > 0) ? "O limite deve ser maior que zero." : undefined,
    account: !account ? "Escolha a conta de pagamento." : undefined,
  };

  const save = async () => {
    setShowErrors(true);
    if (Object.values(errors).some(Boolean)) return;
    setSaving(true);
    try {
      await api.cards.create({ name: name.trim() || null, cardLimit: limit, closeDay, invoiceDueDay: dueDay, institutionId: bank?.id ?? null, standardPaymentAccountId: Number(account.split("-")[1]) });
      toast.success("Cartão criado");
      void invalidateFinancial(qc);
      onClose();
    } catch {
      toast.error("Não foi possível criar o cartão.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={step === 1 ? "Banco do cartão" : "Detalhes do cartão"}
      description={`Passo ${step} de 2`}
      size="md"
      footer={
        <div className="flex items-center justify-between gap-2">
          {step === 2 ? (
            <Button variant="ghost" onClick={() => setStep(1)}>
              <ArrowLeft aria-hidden /> Voltar
            </Button>
          ) : (
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
          )}
          {step === 2 && (
            <Button variant="primary" onClick={save} loading={saving}>
              Criar cartão
            </Button>
          )}
        </div>
      }
    >
      {step === 1 ? (
        <div className="grid gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
            <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar banco" className="pl-9" aria-label="Buscar banco" />
          </div>
          <ul className="grid max-h-[46dvh] gap-1 overflow-y-auto pr-1 scrollbar-thin">
            {list.map((i) => (
              <li key={i.id}>
                <button type="button" onClick={() => chooseBank(i)} className="flex w-full items-center gap-3 rounded-[var(--radius-md)] px-2 py-2 text-left hover:bg-surface-2">
                  <InstitutionLogo institutionId={i.id} size="sm" />
                  <span className="text-sm">{i.name}</span>
                </button>
              </li>
            ))}
          </ul>
          <Button variant="secondary" onClick={() => chooseBank(null)}>
            <CreditCard aria-hidden /> Sem banco da lista
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {bank && (
            <div className="flex items-center gap-3 rounded-[var(--radius-lg)] bg-surface-2 px-3.5 py-3">
              <InstitutionLogo institutionId={bank.id} size="sm" />
              <span className="text-sm font-medium">{bank.name}</span>
            </div>
          )}
          <Field label="Nome" htmlFor="nc-name" optional={Boolean(bank)} error={showErrors ? errors.name : undefined} counter={{ value: name.length, max: 40 }}>
            <Input id="nc-name" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder={bank?.name ?? "Ex.: Cartão da loja"} />
          </Field>
          <Field label="Limite" htmlFor="nc-limit" error={showErrors ? errors.limit : undefined}>
            <MoneyInput id="nc-limit" currency={currency} value={limit} onValueChange={setLimit} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Vencimento" htmlFor="nc-due">
              <Select
                id="nc-due"
                value={String(dueDay)}
                onValueChange={(v) => {
                  const d = Number(v);
                  setDueDay(d);
                  setDaysTouched(true);
                  if (!closeChosen) setCloseDay(suggestCloseDay(d));
                }}
                options={DAY_OPTIONS}
              />
            </Field>
            <Field label="Fechamento" htmlFor="nc-close" hint={!closeChosen && daysTouched ? "Sugerido: 7 dias antes do vencimento." : undefined}>
              <Select
                id="nc-close"
                value={String(closeDay)}
                onValueChange={(v) => {
                  setCloseDay(Number(v));
                  setCloseChosen(true);
                  setDaysTouched(true);
                }}
                options={DAY_OPTIONS}
              />
            </Field>
          </div>
          {daysTouched && isUnusualGap(closeDay, dueDay) && (
            <p className="rounded-[var(--radius-lg)] bg-warning-soft px-3.5 py-3 text-[13px] text-ink-2">A folga entre fechamento e vencimento está fora do comum (1 a 15 dias). Confira as datas.</p>
          )}
          <Field label="Conta de pagamento padrão" htmlFor="nc-acc" error={showErrors ? errors.account : undefined} hint={accountSuggested ? <Badge tone="brand">Sugerida</Badge> : undefined}>
            <OptionPicker
              id="nc-acc"
              value={account}
              onValueChange={(v) => {
                setAccount(v);
                setAccountSuggested(false);
              }}
              groups={[{ options: accountPickerOptions(accounts, institutions, { topOnly: true }) }]}
            />
          </Field>
        </div>
      )}
    </Modal>
  );
}
