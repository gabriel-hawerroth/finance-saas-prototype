"use client";
import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { ArrowLeft, Check, Landmark, PiggyBank, Search, TrendingUp, Utensils, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { MoneyInput } from "@/components/ui/money-input";
import { SwitchRow } from "@/components/ui/switch";
import { ErrorState } from "@/components/shared/content-state";
import { InstitutionLogo } from "@/components/shared/institution-logo";
import { api } from "@/data/api";
import { invalidateFinancial } from "@/data/sync";
import { ACCOUNT_TYPE_LABEL } from "@/domain/constants";
import type { AccountType, AccountTypeDefaults, Institution } from "@/domain/types";
import { useInstitutions } from "@/features/institutions/queries";
import { openOverlay } from "@/features/overlays/store";
import { useAccounts } from "@/features/picklists/queries";
import { usePrefs } from "@/features/prefs/store";
import { normalize } from "@/lib/text";
import { cn } from "@/lib/utils";

export function openNewAccountWizard(onCreated?: () => void) {
  openOverlay((close) => <NewAccountWizard onClose={close} onCreated={onCreated} />);
}

type Where = { kind: "catalog"; institution: Institution } | { kind: "other"; name: string };

const CASH_TERMS = ["dinheiro", "especie", "cash", "bargeld", "efectivo"];

const TYPE_CHOICES: { type: AccountType; hint: string; icon: React.ElementType }[] = [
  { type: "CHECKING", hint: "Pix, boletos, salário", icon: Landmark },
  { type: "SAVING", hint: "Rende com o tempo", icon: PiggyBank },
  { type: "BROKERAGE", hint: "Corretora, CDB, Tesouro…", icon: TrendingUp },
  { type: "BENEFIT", hint: "VR, VA, saldo flexível", icon: Utensils },
];

export function typeHints(type: AccountType | null | undefined) {
  if (type === "BENEFIT")
    return {
      flow: "Gastos do vale entram nos totais do mês.",
      overall: "Benefícios costumam ficar fora do saldo geral, porque o dinheiro só serve para alimentação.",
    };
  if (type === "BROKERAGE")
    return {
      flow: "Investimentos normalmente ficam fora do fluxo: aportes e rendimentos não são gastos do mês.",
      overall: "O valor investido soma no seu patrimônio.",
    };
  return { flow: "Os lançamentos desta conta entram nos totais do mês.", overall: "O saldo desta conta entra no saldo geral." };
}

/** Three-step account creation (§5.4): where → what kind → details. */
function NewAccountWizard({ onClose, onCreated }: { onClose: () => void; onCreated?: () => void }) {
  const qc = useQueryClient();
  const currency = usePrefs((s) => s.currency);
  const inst = useInstitutions();
  const { data: accounts = [] } = useAccounts();
  const [step, setStep] = React.useState<1 | 2 | 3>(1);
  const [query, setQuery] = React.useState("");
  const [where, setWhere] = React.useState<Where | null>(null);
  const [otherOpen, setOtherOpen] = React.useState(false);
  const [otherName, setOtherName] = React.useState("");
  const [type, setType] = React.useState<AccountType | null>(null);
  const [name, setName] = React.useState("");
  const [balance, setBalance] = React.useState(0);
  const [counts, setCounts] = React.useState(true);
  const [visible, setVisible] = React.useState(true);
  const [defaults, setDefaults] = React.useState<AccountTypeDefaults[] | null>(null);
  const [loadingDefaults, setLoadingDefaults] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const usedInstitutionIds = new Set(accounts.filter((a) => a.active && a.primaryAccountId == null && a.institutionId != null).map((a) => a.institutionId!));

  const results = React.useMemo(() => {
    const list = (inst.data ?? []).filter((i) => {
      const q = normalize(query);
      if (!q) return true;
      if (i.category === "WALLET" && q.length >= 3 && CASH_TERMS.some((t) => t.startsWith(q) || q.startsWith(t))) return true;
      return normalize(i.name).includes(q);
    });
    return list.sort((a, b) => Number(b.category === "WALLET") - Number(a.category === "WALLET"));
  }, [inst.data, query]);

  const pick = (w: Where) => {
    setWhere(w);
    if (w.kind === "catalog" && w.institution.category === "WALLET") {
      setType("CASH");
      void goDetails("CASH");
    } else {
      setStep(2);
    }
  };

  const goDetails = async (t: AccountType) => {
    setType(t);
    setLoadingDefaults(true);
    try {
      const d = defaults ?? (await api.accounts.typeDefaults());
      setDefaults(d);
      const def = d.find((x) => x.type === t);
      setCounts(def?.countsForOverallBalance ?? true);
      setVisible(def?.visibleInCashFlow ?? true);
      setStep(3);
    } catch {
      toast.error("Não foi possível carregar as opções da conta. Tente novamente.");
    } finally {
      setLoadingDefaults(false);
    }
  };

  const whereName = where?.kind === "catalog" ? where.institution.name : where?.name ?? "";
  const existing = where?.kind === "catalog" ? accounts.filter((a) => a.active && a.primaryAccountId == null && a.institutionId === where.institution.id) : [];

  const create = async () => {
    if (!type || !where) return;
    setSaving(true);
    try {
      await api.accounts.create({
        name: name.trim() || null,
        balance,
        countsForOverallBalance: counts,
        visibleInCashFlow: visible,
        institutionId: where.kind === "catalog" ? where.institution.id : null,
        institutionName: where.kind === "other" ? where.name : null,
        type,
      });
      toast.success(`Conta criada em ${whereName}`);
      void invalidateFinancial(qc);
      onCreated?.();
      onClose();
    } catch {
      toast.error("Não foi possível criar a conta.");
    } finally {
      setSaving(false);
    }
  };

  const back = () => {
    if (step === 3 && where?.kind === "catalog" && where.institution.category === "WALLET") setStep(1);
    else setStep((s) => (s > 1 ? ((s - 1) as 1 | 2) : s));
  };

  const titles = { 1: "Onde fica a conta?", 2: "Que conta é?", 3: "Detalhes" };

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={titles[step]}
      description={`Passo ${step} de 3`}
      size="md"
      footer={
        <div className="flex items-center justify-between gap-2">
          {step > 1 ? (
            <Button variant="ghost" onClick={back}>
              <ArrowLeft aria-hidden /> Voltar
            </Button>
          ) : (
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
          )}
          <StepDots step={step} />
          {step === 1 && otherOpen ? (
            <Button variant="primary" disabled={!otherName.trim()} onClick={() => pick({ kind: "other", name: otherName.trim() })}>
              Continuar
            </Button>
          ) : step === 3 ? (
            <Button variant="primary" onClick={create} loading={saving}>
              Criar conta
            </Button>
          ) : (
            <span className="w-24" />
          )}
        </div>
      }
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.16 }}>
          {step === 1 && (
            <div className="grid gap-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
                <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar banco, corretora ou benefício" className="pl-9" aria-label="Buscar instituição" />
              </div>
              {inst.isError && <ErrorState compact onRetry={() => inst.refetch()} />}
              {otherOpen ? (
                <Field label="Nome da instituição" htmlFor="na-other" counter={{ value: otherName.length, max: 40 }}>
                  <Input id="na-other" autoFocus maxLength={40} value={otherName} onChange={(e) => setOtherName(e.target.value)} />
                </Field>
              ) : (
                <ul className="grid max-h-[46dvh] gap-1 overflow-y-auto pr-1 scrollbar-thin" aria-label="Instituições">
                  {results.map((i) => (
                    <li key={i.id}>
                      <button type="button" onClick={() => pick({ kind: "catalog", institution: i })} className="flex w-full items-center gap-3 rounded-[var(--radius-md)] px-2 py-2 text-left hover:bg-surface-2">
                        <InstitutionLogo institutionId={i.id} size="sm" />
                        <span className="flex-1 text-sm">{i.name}</span>
                        {i.category === "WALLET" && <span className="text-xs text-ink-3">dinheiro em espécie</span>}
                        {usedInstitutionIds.has(i.id) && <Badge tone="brand">Você já tem conta</Badge>}
                      </button>
                    </li>
                  ))}
                  {results.length === 0 && query.trim() && (
                    <li>
                      <button type="button" onClick={() => pick({ kind: "other", name: query.trim().slice(0, 40) })} className="flex w-full items-center gap-3 rounded-[var(--radius-md)] border border-dashed border-line-strong px-3 py-3 text-left hover:bg-surface-2">
                        <Plus className="size-4" aria-hidden />
                        <span className="text-sm">
                          Usar “<strong className="font-medium">{query.trim()}</strong>”
                        </span>
                      </button>
                    </li>
                  )}
                </ul>
              )}
              {!otherOpen && (
                <Button
                  variant="link"
                  className="justify-self-start"
                  onClick={() => {
                    setOtherOpen(true);
                    setOtherName(query.trim().slice(0, 40));
                  }}
                >
                  Não está na lista? Usar outra instituição
                </Button>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-3">
              {existing.length > 0 && (
                <p className="rounded-[var(--radius-lg)] bg-surface-2 px-3.5 py-3 text-[13px] text-ink-2">
                  Você já tem {existing.length === 1 ? "uma conta" : `${existing.length} contas`} em {whereName}. A conta nova aparece junto.
                </p>
              )}
              <div className="grid gap-2 sm:grid-cols-2">
                {TYPE_CHOICES.map((c) => (
                  <button
                    key={c.type}
                    type="button"
                    disabled={loadingDefaults}
                    onClick={() => goDetails(c.type)}
                    className={cn("flex flex-col items-start gap-2 rounded-[var(--radius-lg)] border border-line p-4 text-left transition-colors hover:border-ink hover:bg-surface-2", type === c.type && loadingDefaults && "border-ink")}
                  >
                    <c.icon className="size-5 text-ink-2" aria-hidden />
                    <span className="font-medium">{ACCOUNT_TYPE_LABEL[c.type]}</span>
                    <span className="text-[13px] text-ink-3">{c.hint}</span>
                  </button>
                ))}
              </div>
              <p className="text-[13px] text-ink-3">É uma caixinha ou cofrinho? Crie a conta principal primeiro e depois use “Novo cofrinho” dentro dela.</p>
            </div>
          )}

          {step === 3 && type && (
            <div className="grid gap-5">
              <div className="flex items-center gap-3 rounded-[var(--radius-lg)] bg-surface-2 px-3.5 py-3">
                <InstitutionLogo institutionId={where?.kind === "catalog" ? where.institution.id : null} name={whereName} size="sm" />
                <div>
                  <p className="text-sm font-medium">{whereName}</p>
                  <p className="text-xs text-ink-3">{ACCOUNT_TYPE_LABEL[type]}</p>
                </div>
                <Check className="ml-auto size-4 text-positive" aria-hidden />
              </div>
              <Field label="Nome" htmlFor="na-name" optional hint={`Sem nome, aparece como “${whereName} › ${ACCOUNT_TYPE_LABEL[type]}”.`} counter={{ value: name.length, max: 40 }}>
                <Input id="na-name" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder={ACCOUNT_TYPE_LABEL[type]} />
              </Field>
              <Field label="Saldo de hoje" htmlFor="na-balance" hint="Pode ser negativo (ex.: cheque especial).">
                <MoneyInput id="na-balance" size="lg" currency={currency} allowNegative value={balance} onValueChange={setBalance} />
              </Field>
              <div className="grid gap-3 rounded-[var(--radius-lg)] border border-line p-4">
                <SwitchRow id="na-overall" label="Entra no saldo geral" hint={typeHints(type).overall} checked={counts} onCheckedChange={setCounts} />
                <SwitchRow id="na-flow" label="Visível no fluxo de caixa" hint={typeHints(type).flow} checked={visible} onCheckedChange={setVisible} />
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </Modal>
  );
}

function StepDots({ step }: { step: number }) {
  return (
    <span className="flex gap-1.5" aria-hidden>
      {[1, 2, 3].map((s) => (
        <span key={s} className={cn("h-1.5 rounded-full transition-all", s === step ? "w-5 bg-ink" : "w-1.5 bg-line-strong")} />
      ))}
    </span>
  );
}
