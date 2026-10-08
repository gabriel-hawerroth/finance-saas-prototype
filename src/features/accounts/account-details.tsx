"use client";
import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  FolderInput,
  Pencil,
  PiggyBank,
  Plus,
  Repeat2,
  Scale,
  Sparkles,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Progress } from "@/components/ui/progress";
import { AuditInfo } from "@/components/shared/audit-info";
import { ErrorState, ListSkeleton } from "@/components/shared/content-state";
import { InstitutionLogo } from "@/components/shared/institution-logo";
import { Money, useMoneyFormatter } from "@/components/shared/money";
import { api } from "@/data/api";
import { invalidateFinancial } from "@/data/sync";
import { accountHeading, goalProgress, institutionNameOf, piggiesOf } from "@/domain/accounts-view";
import { ACCOUNT_TYPE_LABEL } from "@/domain/constants";
import type { Account, Id } from "@/domain/types";
import { useInstitutions } from "@/features/institutions/queries";
import { openOverlay } from "@/features/overlays/store";
import { useAccounts, useCategories } from "@/features/picklists/queries";
import { openReleaseForm } from "@/features/releases/release-form";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  archiveAccount,
  deleteAccount,
  openAdjustBalance,
  openMoveInto,
  openPiggyForm,
  openRedeem,
  openYieldDialog,
  reactivateAccount,
  startSave,
} from "./account-actions";

export function openAccountDetails(accountId: Id) {
  openOverlay((close) => <AccountDetails accountId={accountId} onClose={close} />);
}

interface Action {
  key: string;
  label: string;
  icon: React.ElementType;
  run: () => void;
  tone?: "danger";
  primary?: boolean;
}

/** Account / piggy-bank details with every money action (§5.5). */
function AccountDetails({ accountId, onClose }: { accountId: Id; onClose: () => void }) {
  const qc = useQueryClient();
  const router = useRouter();
  const fmt = useMoneyFormatter();
  const accountsQ = useAccounts();
  const { data: institutions = [] } = useInstitutions();
  const { data: categories = [] } = useCategories();
  const accounts = accountsQ.data ?? [];
  const account = accounts.find((a) => a.id === accountId);

  if (accountsQ.isPending || accountsQ.isError || !account) {
    return (
      <Modal open onOpenChange={(o) => !o && onClose()} title="Conta" variant="side">
        {accountsQ.isPending ? <ListSkeleton rows={4} /> : <ErrorState onRetry={() => accountsQ.refetch()} message={!account && accountsQ.isSuccess ? "Esta conta não existe mais." : undefined} />}
      </Modal>
    );
  }

  const isPiggy = account.primaryAccountId != null;
  const parent = isPiggy ? accounts.find((a) => a.id === account.primaryAccountId) : undefined;
  const piggies = isPiggy ? [] : piggiesOf(account, accounts);
  const activePiggies = piggies.filter((p) => p.active);
  const piggyTotal = activePiggies.reduce((s, p) => s + p.balance, 0);
  const { title, subtitle } = accountHeading(account, accounts, institutions);
  const progress = goalProgress(account.balance, account.goal);
  const active = account.active;
  const isBrokerage = account.type === "BROKERAGE";
  const yieldable = isPiggy || account.type === "CHECKING" || account.type === "SAVING" || isBrokerage;
  const hasMoveTarget = accounts.some((a) => a.active && a.canHoldPiggyBanks && a.id !== account.id);

  const after = (fn: () => void) => () => {
    onClose();
    fn();
  };

  const actions: Action[] = [];
  if (!isPiggy && account.canHoldPiggyBanks) actions.push({ key: "piggy", label: "Novo cofrinho", icon: Plus, run: after(() => openPiggyForm({ parent: account })) });
  if (isPiggy && active) {
    actions.push({ key: "save", label: "Guardar", icon: ArrowDownToLine, primary: true, run: after(() => void startSave(account)) });
    actions.push({
      key: "withdraw",
      label: "Resgatar",
      icon: ArrowUpFromLine,
      run: after(() => openReleaseForm({ mode: "new", type: "T", title: `Resgatar de ${account.displayName}`, preset: { accountId: account.id, targetAccountId: account.primaryAccountId!, description: `Resgate de ${account.displayName}` } })),
    });
  }
  if (!isPiggy && isBrokerage && active) {
    actions.push({ key: "apply", label: "Aplicar", icon: ArrowDownToLine, primary: true, run: after(() => openReleaseForm({ mode: "new", type: "T", title: `Aplicar em ${account.displayName}`, preset: { targetAccountId: account.id, description: "Aplicação" } })) });
    actions.push({ key: "redeem", label: "Resgatar", icon: ArrowUpFromLine, run: after(() => openRedeem(account, accounts, institutions, categories)) });
  }
  if (active && yieldable) actions.push({ key: "yield", label: "Registrar rendimento", icon: TrendingUp, run: after(() => openYieldDialog(account, "YIELD", categories, () => openAdjustBalance(account, piggies.length > 0))) });
  if (active && isBrokerage && !isPiggy) actions.push({ key: "appreciation", label: "Registrar valorização", icon: Sparkles, run: after(() => openYieldDialog(account, "APPRECIATION", categories, () => openAdjustBalance(account, false))) });
  if (isPiggy && active)
    actions.push({
      key: "purpose",
      label: account.purpose === "INVESTMENT" ? "Mudar para Guardar" : "Mudar para Investir",
      icon: Repeat2,
      run: async () => {
        try {
          await api.accounts.update(account.id, { name: account.displayName, purpose: account.purpose === "INVESTMENT" ? "SAVINGS" : "INVESTMENT", goal: account.goal, countsForOverallBalance: account.countsForOverallBalance, visibleInCashFlow: account.visibleInCashFlow });
          toast.success("Finalidade alterada");
          void invalidateFinancial(qc);
          onClose();
        } catch {
          toast.error("Não foi possível alterar a finalidade.");
        }
      },
    });
  if (account.canBecomePiggyBank && hasMoveTarget) actions.push({ key: "move", label: "Mover para dentro de…", icon: FolderInput, run: after(() => openMoveInto(account, accounts, institutions)) });
  actions.push({ key: "edit", label: "Editar", icon: Pencil, run: after(() => (isPiggy ? openPiggyForm({ parent: parent!, piggy: account }) : router.push(`/contas/${account.id}`))) });
  actions.push({ key: "adjust", label: "Corrigir saldo", icon: Scale, run: after(() => openAdjustBalance(account, piggies.length > 0)) });
  const canToggleArchive = !isPiggy || active || (parent?.active ?? false);
  if (canToggleArchive)
    actions.push(
      active
        ? { key: "archive", label: "Arquivar", icon: Archive, run: async () => (await archiveAccount(account, piggies, qc, fmt)) && onClose() }
        : { key: "activate", label: "Reativar", icon: ArchiveRestore, run: async () => (await reactivateAccount(account, piggies, qc)) && onClose() },
    );
  actions.push({ key: "delete", label: "Excluir", icon: Trash2, tone: "danger", run: async () => (await deleteAccount(account, piggies, qc, fmt)) && onClose() });

  const primary = actions.filter((a) => a.primary);
  const rest = actions.filter((a) => !a.primary);

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      variant="side"
      title={title}
      description={subtitle}
      leading={isPiggy ? <span className="grid size-10 place-items-center rounded-[11px] bg-brand-soft text-brand-ink"><PiggyBank className="size-5" aria-hidden /></span> : <InstitutionLogo institutionId={account.institutionId} name={account.institutionName ?? account.displayName} />}
    >
      <div className="grid gap-6">
        <div>
          <p className="text-[13px] text-ink-3">{piggies.length ? "Saldo total (conta + cofrinhos)" : "Saldo"}</p>
          <p className={cn("font-display text-5xl leading-tight", account.balance + piggyTotal < 0 && "text-negative")}>
            <Money value={account.balance + piggyTotal} />
          </p>
          {activePiggies.length > 0 && (
            <p className="mt-1 text-sm text-ink-2">
              Disponível <Money value={account.balance} className="font-medium" /> · Em cofrinhos <Money value={piggyTotal} className="font-medium" />
            </p>
          )}
          {progress != null && (
            <div className="mt-3 grid gap-1.5">
              <Progress value={progress} label="Progresso da meta" tone="brand" className="h-2" />
              <p className="text-sm text-ink-2">
                {progress}% de <Money value={account.goal!} />
              </p>
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {!active && <Badge tone="warning" size="md">Arquivada</Badge>}
            {!isPiggy && !account.countsForOverallBalance && <Badge tone="outline" size="md">Fora do saldo geral</Badge>}
          </div>
        </div>

        {primary.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {primary.concat(rest.filter((a) => a.key === "withdraw" || a.key === "redeem")).map((a) => (
              <Button key={a.key} variant={a.primary ? "primary" : "secondary"} size="lg" onClick={a.run}>
                <a.icon aria-hidden /> {a.label}
              </Button>
            ))}
          </div>
        )}

        <dl className="grid grid-cols-2 gap-4 text-sm">
          {isPiggy ? (
            <>
              <Item label="Finalidade">{account.purpose === "INVESTMENT" ? "Investir (conta em Investimentos)" : "Guardar (conta em “Em cofrinhos”)"}</Item>
              <Item label="Saldo geral e fluxo de caixa">Seguem a conta {parent?.displayName}</Item>
            </>
          ) : (
            <>
              <Item label="Tipo">{account.type ? ACCOUNT_TYPE_LABEL[account.type] : "—"}</Item>
              <Item label="Instituição">{institutionNameOf(account, institutions) ?? "—"}</Item>
              {account.accountNumber && <Item label="Número">{account.accountNumber}</Item>}
              {account.agency && <Item label="Agência">{account.agency}</Item>}
              {institutions.find((i) => i.id === account.institutionId)?.code && <Item label="Código do banco">{institutions.find((i) => i.id === account.institutionId)?.code}</Item>}
              <Item label="Visível no fluxo de caixa">{account.visibleInCashFlow ? "Sim" : "Não"}</Item>
              <Item label="Entra no saldo geral">{account.countsForOverallBalance ? "Sim" : "Não"}</Item>
              <Item label="Ativa">{account.active ? "Sim" : "Não"}</Item>
            </>
          )}
        </dl>

        {piggies.length > 0 && (
          <section aria-labelledby="ad-piggies">
            <h3 id="ad-piggies" className="mb-2 text-[13px] font-medium text-ink-3">
              Cofrinhos
            </h3>
            <ul className="divide-y divide-line rounded-[var(--radius-lg)] border border-line">
              {piggies.map((p) => {
                const pg = goalProgress(p.balance, p.goal);
                return (
                  <li key={p.id}>
                    <button type="button" onClick={after(() => openAccountDetails(p.id))} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-surface-2">
                      <PiggyBank className="size-4 text-ink-3" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{p.displayName}</span>
                        {pg != null && <span className="block text-xs text-ink-3">{pg}% da meta</span>}
                      </span>
                      {!p.active && <Badge tone="warning">Arquivado</Badge>}
                      <Money value={p.balance} className="text-sm" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <div className="grid gap-1.5">
          {rest
            .filter((a) => !(primary.length > 0 && (a.key === "withdraw" || a.key === "redeem")))
            .map((a) => (
              <button
                key={a.key}
                type="button"
                onClick={a.run}
                className={cn("flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-left text-sm transition-colors hover:bg-surface-2", a.tone === "danger" ? "text-negative" : "text-ink")}
              >
                <a.icon className={cn("size-[18px]", a.tone === "danger" ? "text-negative" : "text-ink-3")} aria-hidden />
                <span className="flex-1">{a.label}</span>
                <ArrowRight className="size-4 text-ink-3" aria-hidden />
              </button>
            ))}
        </div>

        <AuditInfo createdAt={account.createdAt} updatedAt={account.updatedAt} />
      </div>
    </Modal>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[13px] text-ink-3">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}

export type { Account };
