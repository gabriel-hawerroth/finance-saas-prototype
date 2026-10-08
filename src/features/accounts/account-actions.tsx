"use client";
import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal, ModalActions } from "@/components/ui/modal";
import { MoneyInput } from "@/components/ui/money-input";
import { OptionPicker } from "@/components/ui/option-picker";
import { Segmented } from "@/components/ui/segmented";
import { Money, useMoneyFormatter } from "@/components/shared/money";
import { api } from "@/data/api";
import { invalidateFinancial } from "@/data/sync";
import { accountOptionLabel } from "@/domain/accounts-view";
import { isApiError } from "@/domain/errors";
import { suggestCategory } from "@/domain/suggested-category";
import type { Account, BalanceDifference, CategoryWithSubs, Id, Institution, PiggyPurpose } from "@/domain/types";
import { choose, confirm } from "@/features/overlays/dialogs";
import { ask, openOverlay } from "@/features/overlays/store";
import { usePrefs } from "@/features/prefs/store";
import { accountPickerOptions, categoryPickerGroups, resolveCategoryKey } from "@/features/releases/options";
import { openReleaseForm } from "@/features/releases/release-form";
import { round2 } from "@/lib/utils";

/* ───────── Piggy bank form (new / edit) ───────── */

export function openPiggyForm(opts: { parent: Account; piggy?: Account }) {
  openOverlay((close) => <PiggyForm {...opts} onClose={close} />);
}

function PiggyForm({ parent, piggy, onClose }: { parent: Account; piggy?: Account; onClose: () => void }) {
  const qc = useQueryClient();
  const currency = usePrefs((s) => s.currency);
  const [name, setName] = React.useState(piggy?.displayName ?? "");
  const [purpose, setPurpose] = React.useState<PiggyPurpose>(piggy?.purpose ?? "SAVINGS");
  const [initial, setInitial] = React.useState(0);
  const [goal, setGoal] = React.useState(piggy?.goal ?? 0);
  const [saving, setSaving] = React.useState(false);
  const [touched, setTouched] = React.useState(false);
  const nameError = touched && !name.trim() ? "Dê um nome ao cofrinho." : undefined;

  const save = async () => {
    setTouched(true);
    if (!name.trim()) return;
    setSaving(true);
    try {
      const dto = { name: name.trim(), purpose, goal: goal > 0 ? goal : null, countsForOverallBalance: parent.countsForOverallBalance, visibleInCashFlow: parent.visibleInCashFlow };
      if (piggy) await api.accounts.update(piggy.id, dto);
      else await api.accounts.create({ ...dto, primaryAccountId: parent.id, initialAmount: initial > 0 ? initial : null, balance: 0 });
      toast.success(piggy ? "Cofrinho atualizado" : "Cofrinho criado");
      void invalidateFinancial(qc);
      onClose();
    } catch {
      toast.error("Não foi possível salvar o cofrinho.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={piggy ? "Editar cofrinho" : "Novo cofrinho"}
      description={`Dentro de ${parent.displayName}`}
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
        <Field label="Nome" htmlFor="pg-name" error={nameError} counter={{ value: name.length, max: 40 }}>
          <Input id="pg-name" autoFocus maxLength={40} value={name} onChange={(e) => setName(e.target.value)} aria-invalid={Boolean(nameError)} placeholder="Ex.: Reserva de emergência" />
        </Field>
        {!piggy && (
          <>
            <div className="grid gap-1.5">
              <span className="text-[13px] font-medium text-ink-2">Finalidade</span>
              <Segmented
                label="Finalidade"
                stretch
                value={purpose}
                onValueChange={setPurpose}
                options={[
                  { value: "SAVINGS", label: "Guardar" },
                  { value: "INVESTMENT", label: "Investir" },
                ]}
              />
              <p className="text-[13px] text-ink-3">{purpose === "SAVINGS" ? "Conta em “Em cofrinhos” no saldo geral." : "Conta em “Investimentos” no saldo geral."}</p>
            </div>
            <Field label="Guardar agora" htmlFor="pg-initial" optional hint={initial > parent.balance ? <span className="text-warning">É mais do que o disponível na conta (<Money value={parent.balance} />).</span> : "Sai do disponível da conta para o cofrinho."}>
              <MoneyInput id="pg-initial" currency={currency} value={initial} onValueChange={setInitial} />
            </Field>
          </>
        )}
        <Field label="Meta" htmlFor="pg-goal" optional>
          <MoneyInput id="pg-goal" currency={currency} value={goal} onValueChange={setGoal} />
        </Field>
        <p className="rounded-[var(--radius-lg)] bg-surface-2 px-3.5 py-3 text-[13px] text-ink-2">Guardar é transferência, não despesa: o saldo geral continua igual.</p>
      </div>
    </Modal>
  );
}

/* ───────── Guardar (§5.5) ───────── */

export async function startSave(piggy: Account) {
  const origin = await choose<"MINE" | "OTHER">({
    title: "De onde vem o dinheiro?",
    choices: [
      { value: "MINE", label: "De uma conta minha", description: "Transferência para o cofrinho (por padrão, da conta-mãe)." },
      { value: "OTHER", label: "De outra pessoa", description: "Entra como receita no cofrinho e conta no fluxo de caixa." },
    ],
  });
  if (origin === "MINE") {
    openReleaseForm({ mode: "new", type: "T", title: `Guardar em ${piggy.displayName}`, preset: { accountId: piggy.primaryAccountId ?? undefined, targetAccountId: piggy.id, description: `Guardar em ${piggy.displayName}` } });
  } else if (origin === "OTHER") {
    openReleaseForm({ mode: "new", type: "R", title: `Guardar em ${piggy.displayName}`, preset: { accountId: piggy.id } });
  }
}

/* ───────── Corrigir saldo ───────── */

export function openAdjustBalance(account: Account, hasPiggies: boolean) {
  openOverlay((close) => <AdjustBalance account={account} hasPiggies={hasPiggies} onClose={close} />);
}

function AdjustBalance({ account, hasPiggies, onClose }: { account: Account; hasPiggies: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const currency = usePrefs((s) => s.currency);
  const [value, setValue] = React.useState(account.balance);
  const [saving, setSaving] = React.useState(false);
  const changed = Math.abs(value - account.balance) > 0.004;
  const save = async () => {
    setSaving(true);
    try {
      await api.accounts.adjustBalance(account.id, value);
      toast.success("Saldo corrigido");
      void invalidateFinancial(qc);
      onClose();
    } catch {
      toast.error("Não foi possível corrigir o saldo.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title="Corrigir saldo"
      description={account.displayName}
      size="sm"
      footer={
        <ModalActions>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={save} loading={saving} disabled={!changed}>
            Salvar
          </Button>
        </ModalActions>
      }
    >
      <div className="grid gap-4">
        <Field label={hasPiggies ? "Saldo real em conta (sem os cofrinhos)" : "Saldo real"} htmlFor="adj" hint={<>Hoje no Finax: <Money value={account.balance} /></>}>
          <MoneyInput id="adj" autoFocus size="lg" currency={currency} allowNegative value={value} onValueChange={setValue} />
        </Field>
        {changed && (
          <p className="rounded-[var(--radius-lg)] bg-surface-2 px-3.5 py-3 text-[13px] text-ink-2">
            Será criado um lançamento de ajuste de <Money value={round2(value - account.balance)} signed /> que não entra nos números do mês.
          </p>
        )}
      </div>
    </Modal>
  );
}

/* ───────── Rendimento / valorização (§5.5) ───────── */

type YieldKind = "YIELD" | "APPRECIATION";

export function openYieldDialog(account: Account, kind: YieldKind, categories: CategoryWithSubs[], onAdjust: () => void) {
  openOverlay((close) => <YieldDialog account={account} kind={kind} categories={categories} onClose={close} onAdjust={onAdjust} />);
}

function YieldDialog({ account, kind, categories, onClose, onAdjust }: { account: Account; kind: YieldKind; categories: CategoryWithSubs[]; onClose: () => void; onAdjust: () => void }) {
  const currency = usePrefs((s) => s.currency);
  const fmt = useMoneyFormatter();
  const isPiggy = account.primaryAccountId != null;
  const [mode, setMode] = React.useState<"TODAY" | "AMOUNT">(kind === "APPRECIATION" || isPiggy ? "TODAY" : "AMOUNT");
  const [value, setValue] = React.useState(0);
  const [result, setResult] = React.useState<{ value: number; diff: BalanceDifference | null } | null>(null);
  const wantsDiff = mode === "TODAY" && value !== 0;
  const diff = wantsDiff && result?.value === value ? result.diff : null;
  const checking = wantsDiff && result?.value !== value;

  React.useEffect(() => {
    if (!wantsDiff) return;
    const handle = setTimeout(async () => {
      const d = await api.accounts.balanceDifference(account.id, value).catch(() => null);
      setResult({ value, diff: d });
    }, 300);
    return () => clearTimeout(handle);
  }, [wantsDiff, value, account.id]);

  const proceed = () => {
    let amount = value;
    let direction: "UP" | "DOWN" = "UP";
    if (mode === "TODAY") {
      if (!diff || diff.direction === "NONE") return;
      amount = diff.amount;
      direction = diff.direction;
    }
    if (kind === "YIELD" && direction === "DOWN") return;
    const suggestion = suggestCategory(categories, kind === "YIELD" ? "INCOME_YIELD" : direction === "UP" ? "APPRECIATION" : "DEPRECIATION");
    onClose();
    openReleaseForm({
      mode: "new",
      type: direction === "UP" ? "R" : "E",
      title: kind === "YIELD" ? "Registrar rendimento" : "Registrar valorização",
      preset: {
        amount,
        accountId: account.id,
        categoryId: suggestion?.id ?? null,
        description: kind === "YIELD" ? "Rendimento" : direction === "UP" ? "Valorização" : "Desvalorização",
        outOfFlow: kind === "APPRECIATION",
      },
    });
  };

  let explanation: React.ReactNode = null;
  let canContinue = mode === "AMOUNT" ? value > 0 : false;
  if (mode === "TODAY" && diff) {
    if (diff.direction === "NONE") explanation = "O saldo é o mesmo de hoje: nada para registrar.";
    else if (kind === "YIELD" && diff.direction === "UP") {
      explanation = `Rendimento de ${fmt(diff.amount)}, entra como receita.`;
      canContinue = true;
    } else if (kind === "YIELD") {
      explanation = (
        <>
          O valor caiu {fmt(diff.amount)}, então não é rendimento.{" "}
          <button type="button" className="font-medium underline" onClick={() => { onClose(); onAdjust(); }}>
            Corrigir saldo
          </button>
          {account.type === "BROKERAGE" && !isPiggy ? " ou registrar valorização." : "."}
        </>
      );
    } else {
      explanation = diff.direction === "UP" ? `Valorização de ${fmt(diff.amount)}: receita fora do fluxo de caixa.` : `Desvalorização de ${fmt(diff.amount)}: despesa fora do fluxo de caixa.`;
      canContinue = true;
    }
  }

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={kind === "YIELD" ? "Registrar rendimento" : "Registrar valorização"}
      description={account.displayName}
      size="sm"
      footer={
        <ModalActions>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={proceed} disabled={!canContinue || checking}>
            Continuar
          </Button>
        </ModalActions>
      }
    >
      <div className="grid gap-4">
        {kind === "YIELD" && (
          <Segmented
            label="Como informar"
            stretch
            value={mode}
            onValueChange={(m) => {
              setMode(m);
              setValue(0);
            }}
            options={[
              { value: "TODAY", label: "Quanto tem hoje" },
              { value: "AMOUNT", label: "Quanto rendeu" },
            ]}
          />
        )}
        <Field label={mode === "TODAY" ? (kind === "YIELD" ? "Quanto tem hoje" : "Quanto a conta vale hoje") : "Quanto rendeu"} htmlFor="yd-v" hint={mode === "TODAY" ? <>Hoje no Finax: <Money value={account.balance} /></> : undefined}>
          <MoneyInput id="yd-v" autoFocus size="lg" currency={currency} value={value} onValueChange={setValue} />
        </Field>
        <div aria-live="polite" className="min-h-6 text-sm text-ink-2">
          {checking ? <span className="text-ink-3">Calculando…</span> : explanation}
        </div>
      </div>
    </Modal>
  );
}

/* ───────── Resgatar investimento (§5.5) ───────── */

export function openRedeem(account: Account, accounts: Account[], institutions: Institution[], categories: CategoryWithSubs[]) {
  openOverlay((close) => <RedeemDialog account={account} accounts={accounts} institutions={institutions} categories={categories} onClose={close} />);
}

function RedeemDialog({ account, accounts, institutions, categories, onClose }: { account: Account; accounts: Account[]; institutions: Institution[]; categories: CategoryWithSubs[]; onClose: () => void }) {
  const qc = useQueryClient();
  const currency = usePrefs((s) => s.currency);
  const sameInst = accounts.filter((a) => a.active && a.primaryAccountId == null && a.type === "CHECKING" && a.institutionId != null && a.institutionId === account.institutionId);
  const [target, setTarget] = React.useState(sameInst.length === 1 ? `acc-${sameInst[0].id}` : "");
  const [redeemed, setRedeemed] = React.useState(0);
  const [received, setReceived] = React.useState(0);
  const [receivedEdited, setReceivedEdited] = React.useState(false);
  const taxSuggestion = suggestCategory(categories, "TAX");
  const [taxCategory, setTaxCategory] = React.useState(taxSuggestion ? `cat-${taxSuggestion.id}` : "");
  const [saving, setSaving] = React.useState(false);
  const tax = round2(redeemed - received);

  const errors = {
    target: !target ? "Escolha a conta de destino." : undefined,
    redeemed: !(redeemed > 0) ? "Informe o valor resgatado." : undefined,
    received: !(received > 0) ? "Informe quanto caiu na conta." : received > redeemed + 0.004 ? "Não pode ser maior que o valor resgatado." : undefined,
    tax: tax > 0.004 && !taxCategory ? "Escolha a categoria do imposto." : undefined,
  };
  const [showErrors, setShowErrors] = React.useState(false);

  const save = async () => {
    setShowErrors(true);
    if (Object.values(errors).some(Boolean)) return;
    const toId = Number(target.split("-")[1]);
    if (tax <= 0.004) {
      onClose();
      openReleaseForm({ mode: "new", type: "T", title: "Resgatar investimento", preset: { accountId: account.id, targetAccountId: toId, amount: redeemed, description: "Resgate de investimento" } });
      return;
    }
    setSaving(true);
    try {
      await api.accounts.redeem({
        fromAccountId: account.id,
        toAccountId: toId,
        redeemedAmount: redeemed,
        receivedAmount: received,
        taxCategoryId: resolveCategoryKey(taxCategory, categories).categoryId,
        transferDescription: `Resgate de ${account.displayName}`,
        taxDescription: "Imposto retido no resgate",
      });
      toast.success("Resgate registrado");
      void invalidateFinancial(qc);
      onClose();
    } catch {
      toast.error("Não foi possível registrar o resgate.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title="Resgatar investimento"
      description={account.displayName}
      size="sm"
      footer={
        <ModalActions>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={save} loading={saving}>
            {tax > 0.004 ? "Registrar resgate" : "Continuar"}
          </Button>
        </ModalActions>
      }
    >
      <div className="grid gap-4">
        <Field label="Para qual conta" htmlFor="rd-target" error={showErrors ? errors.target : undefined}>
          <OptionPicker id="rd-target" value={target} onValueChange={setTarget} groups={[{ options: accountPickerOptions(accounts, institutions, { excludeId: account.id }) }]} invalid={showErrors && Boolean(errors.target)} />
        </Field>
        <Field label="Valor resgatado" htmlFor="rd-red" error={showErrors ? errors.redeemed : undefined}>
          <MoneyInput
            id="rd-red"
            currency={currency}
            value={redeemed}
            onValueChange={(v) => {
              setRedeemed(v);
              if (!receivedEdited) setReceived(v);
            }}
          />
        </Field>
        <Field label="Quanto caiu na conta" htmlFor="rd-rec" error={showErrors ? errors.received : undefined}>
          <MoneyInput
            id="rd-rec"
            currency={currency}
            value={received}
            onValueChange={(v) => {
              setReceived(v);
              setReceivedEdited(true);
            }}
          />
        </Field>
        {tax > 0.004 && (
          <>
            <p className="rounded-[var(--radius-lg)] bg-warning-soft px-3.5 py-3 text-[13px] text-ink-2">
              A diferença de <Money value={tax} className="font-medium" /> será registrada como imposto retido (despesa).
            </p>
            <Field label="Categoria do imposto" htmlFor="rd-tax" error={showErrors ? errors.tax : undefined}>
              <OptionPicker id="rd-tax" value={taxCategory} onValueChange={setTaxCategory} groups={categoryPickerGroups(categories, "E")} />
            </Field>
          </>
        )}
      </div>
    </Modal>
  );
}

/* ───────── Mover para dentro de… ───────── */

export function openMoveInto(account: Account, accounts: Account[], institutions: Institution[]) {
  openOverlay((close) => <MoveInto account={account} accounts={accounts} institutions={institutions} onClose={close} />);
}

function MoveInto({ account, accounts, institutions, onClose }: { account: Account; accounts: Account[]; institutions: Institution[]; onClose: () => void }) {
  const qc = useQueryClient();
  const candidates = accounts.filter((a) => a.active && a.canHoldPiggyBanks && a.id !== account.id);
  const [target, setTarget] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const save = async () => {
    const id = Number(target.split("-")[1]);
    setSaving(true);
    try {
      await api.accounts.update(account.id, { name: account.name ?? account.displayName, primaryAccountId: id, purpose: "SAVINGS", countsForOverallBalance: account.countsForOverallBalance, visibleInCashFlow: account.visibleInCashFlow });
      toast.success("Agora é um cofrinho");
      void invalidateFinancial(qc);
      onClose();
    } catch {
      toast.error("Não foi possível mover a conta.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title="Mover para dentro de…"
      description="A conta vira um cofrinho. Saldo e lançamentos são mantidos."
      size="sm"
      footer={
        <ModalActions>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={save} disabled={!target} loading={saving}>
            Mover
          </Button>
        </ModalActions>
      }
    >
      <Field label="Conta de destino" htmlFor="mi-target">
        <OptionPicker id="mi-target" value={target} onValueChange={setTarget} groups={[{ options: candidates.map((a) => ({ value: `acc-${a.id}`, label: accountOptionLabel(a, accounts, institutions) })) }]} />
      </Field>
    </Modal>
  );
}

/* ───────── Arquivar / reativar / excluir ───────── */

export async function archiveAccount(account: Account, piggies: Account[], qc: ReturnType<typeof useQueryClient>, fmt: (v: number) => string): Promise<boolean> {
  const isPiggy = account.primaryAccountId != null;
  const saved = piggies.filter((p) => p.active).reduce((s, p) => s + p.balance, 0);
  const message = isPiggy
    ? account.balance > 0.004
      ? `Arquivar devolve ${fmt(account.balance)} ao disponível da conta, por transferência.`
      : "Arquivar este cofrinho?"
    : piggies.some((p) => p.active)
      ? `Arquiva também todos os cofrinhos, com ${fmt(saved)} guardados. Lançamentos pendentes continuarão em contas a pagar e a receber.`
      : "Arquivar esta conta? Lançamentos pendentes continuarão em contas a pagar e a receber.";
  if (!(await confirm({ message, confirmLabel: "Arquivar" }))) return false;
  try {
    await api.accounts.inactivate(account.id);
    toast.success(isPiggy ? "Cofrinho arquivado" : "Conta arquivada");
    void invalidateFinancial(qc);
    return true;
  } catch (error) {
    if (isApiError(error, "PIGGY_BANK_NEGATIVE_BALANCE")) toast.warning("O cofrinho está com saldo negativo. Corrija o saldo antes de arquivar.");
    else toast.error("Não foi possível arquivar.");
    return false;
  }
}

export async function reactivateAccount(account: Account, piggies: Account[], qc: ReturnType<typeof useQueryClient>): Promise<boolean> {
  let subIds: Id[] = [];
  const archivedPiggies = piggies.filter((p) => !p.active);
  if (account.primaryAccountId == null && archivedPiggies.length > 0) {
    const chosen = await ask<Id[]>((answer) => <ReactivatePicker piggies={archivedPiggies} onAnswer={answer} />);
    if (!chosen) return false;
    subIds = chosen;
  } else if (!(await confirm({ message: "Reativar esta conta?", confirmLabel: "Reativar" }))) {
    return false;
  }
  try {
    await api.accounts.activate(account.id, subIds);
    toast.success("Reativada");
    void invalidateFinancial(qc);
    return true;
  } catch {
    toast.error("Não foi possível reativar.");
    return false;
  }
}

function ReactivatePicker({ piggies, onAnswer }: { piggies: Account[]; onAnswer: (v: Id[] | null) => void }) {
  const [selected, setSelected] = React.useState<Id[]>(piggies.map((p) => p.id));
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onAnswer(null)}
      title="Reativar conta"
      description="Escolha quais cofrinhos voltam junto."
      size="sm"
      footer={
        <ModalActions>
          <Button onClick={() => onAnswer(null)}>Cancelar</Button>
          <Button variant="primary" onClick={() => onAnswer(selected)}>
            Reativar
          </Button>
        </ModalActions>
      }
    >
      <ul className="grid gap-2">
        {piggies.map((p) => (
          <li key={p.id}>
            <label className="flex items-center gap-3 rounded-[var(--radius-md)] border border-line px-3 py-2.5">
              <Checkbox checked={selected.includes(p.id)} onCheckedChange={(c) => setSelected((s) => (c ? [...s, p.id] : s.filter((x) => x !== p.id)))} />
              <span className="flex-1 text-sm">{p.displayName}</span>
              <Money value={p.balance} className="text-sm text-ink-3" />
            </label>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

export async function deleteAccount(account: Account, piggies: Account[], qc: ReturnType<typeof useQueryClient>, fmt: (v: number) => string): Promise<boolean> {
  const isPiggy = account.primaryAccountId != null;
  const message = isPiggy ? "Excluir esse cofrinho?" : piggies.length ? "Excluir esta conta? Isso excluirá também todos os cofrinhos." : "Excluir esta conta?";
  if (!(await confirm({ message, confirmLabel: "Excluir", tone: "danger" }))) return false;
  try {
    await api.accounts.remove(account.id);
    toast.success("Excluída");
    void invalidateFinancial(qc);
    return true;
  } catch (error) {
    if (isApiError(error, "LINKED_REGISTERS")) {
      if (!account.active) {
        toast.warning("Esta conta tem registros vinculados e não pode ser excluída.");
        return false;
      }
      const ok = await confirm({
        title: "Não dá para excluir",
        message: isPiggy
          ? "Este cofrinho tem lançamentos vinculados. Você pode arquivá-lo: o que estiver nele volta para a conta."
          : "Esta conta tem lançamentos vinculados. Você pode arquivá-la: lançamentos pendentes continuarão em contas a pagar e a receber.",
        confirmLabel: "Arquivar",
      });
      if (ok) {
        try {
          await api.accounts.inactivate(account.id);
          toast.success("Arquivada");
          void invalidateFinancial(qc);
          return true;
        } catch (e) {
          if (isApiError(e, "PIGGY_BANK_NEGATIVE_BALANCE")) toast.warning("O cofrinho está com saldo negativo. Corrija o saldo antes de arquivar.");
          else toast.error("Não foi possível arquivar.");
        }
      }
      void fmt;
      return false;
    }
    toast.error("Não foi possível excluir.");
    return false;
  }
}
