"use client";
import * as React from "react";
import { CreditCard, Info, Landmark, PiggyBank, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/menu";
import { Progress } from "@/components/ui/progress";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/shared/content-state";
import { InstitutionLogo } from "@/components/shared/institution-logo";
import { Money } from "@/components/shared/money";
import { PageHeader } from "@/components/shared/page-header";
import { GROUP_LABEL, goalProgress, groupByInstitution, groupByType, institutionNameOf, type AccountRow, type InstitutionGroup } from "@/domain/accounts-view";
import { ACCOUNT_TYPE_SHORT } from "@/domain/constants";
import type { Account, AccountsOverallBalance, CreditCard as Card } from "@/domain/types";
import { openCardDetails } from "@/features/cards/card-details";
import { useInstitutions } from "@/features/institutions/queries";
import { useAccounts, useCards } from "@/features/picklists/queries";
import { formatDayMonth } from "@/lib/dates";
import { normalize } from "@/lib/text";
import { cn } from "@/lib/utils";
import { openAccountDetails } from "./account-details";
import { openNewAccountWizard } from "./new-account-wizard";
import { useOverallBalance } from "./queries";

/* ───────── overall balance ───────── */

function OverallBalance({ data }: { data: AccountsOverallBalance }) {
  const parts = [
    { key: "available", label: "Disponível", value: data.availableBalance, color: "bg-ink" },
    { key: "saved", label: "Em cofrinhos", value: data.savedBalance, color: "bg-brand" },
    { key: "investments", label: "Investimentos", value: data.investmentsBalance, color: "bg-transfer" },
  ];
  const showComposition = data.savedBalance !== 0 || data.investmentsBalance !== 0;
  const positiveTotal = parts.reduce((s, p) => s + Math.max(0, p.value), 0);
  const explanation = (
    <>
      Considera só as contas marcadas para o saldo geral; arquivadas não entram.
      {data.benefitsOutsideBalance !== 0 && <> Benefícios fora do saldo geral: <Money value={data.benefitsOutsideBalance} />.</>}
      {data.totalBalance !== data.overallBalance && <> Somando tudo: <Money value={data.totalBalance} />.</>}
    </>
  );
  return (
    <section aria-labelledby="ob-title" className="grid gap-5 rounded-[var(--radius-2xl)] border border-line bg-surface p-5 sm:p-7 lg:grid-cols-[1fr_1.2fr] lg:items-center">
      <div>
        <div className="flex items-center gap-1">
          <h2 id="ob-title" className="text-sm font-medium text-ink-3">
            Saldo geral
          </h2>
          <Tooltip content={explanation}>
            <button type="button" aria-label="Como o saldo geral é calculado" className="grid size-6 place-items-center rounded-full text-ink-3 hover:text-ink">
              <Info className="size-3.5" />
            </button>
          </Tooltip>
        </div>
        <p className={cn("font-display text-[52px] leading-tight sm:text-[64px]", data.overallBalance < 0 && "text-negative")}>
          <Money value={data.overallBalance} />
        </p>
        <p className="text-[13px] text-ink-3 md:hidden">{explanation}</p>
      </div>
      {showComposition && (
        <div className="grid gap-3">
          <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" aria-hidden>
            {parts
              .filter((p) => p.value > 0)
              .map((p) => (
                <div key={p.key} className={cn("first:rounded-l-full last:rounded-r-full", p.color)} style={{ width: `${(p.value / positiveTotal) * 100}%` }} />
              ))}
          </div>
          <dl className="grid grid-cols-3 gap-3">
            {parts.map((p) => (
              <div key={p.key}>
                <dt className="flex items-center gap-1.5 text-xs text-ink-3">
                  <span className={cn("size-2 rounded-full", p.color)} aria-hidden />
                  {p.label}
                </dt>
                <dd className="mt-0.5 text-[13px] font-semibold sm:text-base">
                  <Money value={p.value} tone={p.value < 0 ? "negative" : "neutral"} />
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </section>
  );
}

/* ───────── rows ───────── */

function cardPhrase(c: Card): React.ReactNode {
  const s = c.invoiceSummary;
  if (s.state === "OPEN") return <>fatura aberta <Money value={s.amount} /> · fecha {formatDayMonth(s.closeDate)}</>;
  if (s.state === "CLOSED") return <>fatura fechada <Money value={s.outstanding} /> · vence {formatDayMonth(s.dueDate)}</>;
  return <>fatura paga <Money value={s.amount} /> · vence {formatDayMonth(s.dueDate)}</>;
}

function Marks({ account }: { account: Account }) {
  return (
    <>
      {!account.active && <Badge tone="warning">{account.primaryAccountId ? "Arquivado" : "Arquivada"}</Badge>}
      {account.primaryAccountId == null && !account.countsForOverallBalance && <Badge tone="outline">Fora do saldo geral</Badge>}
    </>
  );
}

function PiggyRow({ piggy }: { piggy: Account }) {
  const pg = goalProgress(piggy.balance, piggy.goal);
  return (
    <li>
      <button type="button" onClick={() => openAccountDetails(piggy.id)} className="flex w-full items-center gap-3 rounded-[var(--radius-md)] py-2 pl-3 pr-3 text-left hover:bg-surface-2 sm:pl-14">
        <PiggyBank className="size-4 shrink-0 text-ink-3" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-sm">
            <span className="truncate">{piggy.displayName}</span>
            <Badge tone={piggy.group === "INVESTMENTS" ? "transfer" : "brand"}>{piggy.group === "INVESTMENTS" ? "Investir" : "Guardar"}</Badge>
            <Marks account={piggy} />
          </span>
          {pg != null && (
            <span className="mt-1.5 flex items-center gap-2">
              <Progress value={pg} label={`Meta de ${piggy.displayName}`} tone="brand" className="max-w-40" />
              <span className="text-[11px] text-ink-3">
                {pg}% de <Money value={piggy.goal!} />
              </span>
            </span>
          )}
        </span>
        <Money value={piggy.balance} className="text-sm font-medium" />
      </button>
    </li>
  );
}

function piggySummary(row: AccountRow) {
  const active = row.piggies.filter((p) => p.active);
  if (!active.length) return null;
  return (
    <>
      <Money value={active.reduce((s, p) => s + p.balance, 0)} /> em {active.length === 1 ? "1 cofrinho" : `${active.length} cofrinhos`}
    </>
  );
}

function GroupBlock({ group }: { group: InstitutionGroup }) {
  const single = group.rows.length === 1 ? group.rows[0] : null;
  const name = group.name;
  const header = (
    <>
      <InstitutionLogo institutionId={group.institution?.id} name={name} size="md" />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="truncate text-[15px] font-semibold">{name}</span>
          {single && <Marks account={single.account} />}
        </span>
        <span className="block truncate text-[13px] text-ink-3">
          {single ? (
            <>
              {single.account.type ? ACCOUNT_TYPE_SHORT[single.account.type] : "Conta"}
              {single.piggies.some((p) => p.active) ? (
                <>
                  {" "}
                  · disponível <Money value={single.account.balance} />
                </>
              ) : single.account.name && normalize(single.account.name) !== normalize(name) ? (
                ` · ${single.account.name}`
              ) : null}
            </>
          ) : group.rows.length > 1 ? (
            `${group.rows.length} contas`
          ) : (
            `${group.cards.length} ${group.cards.length === 1 ? "cartão" : "cartões"}`
          )}
        </span>
      </span>
      {group.rows.length > 0 && (
        <span className="text-right">
          <Money value={group.total} className="block text-[15px] font-semibold" tone={group.total < 0 ? "negative" : "neutral"} />
          <span className="block max-w-[46vw] truncate text-[11px] text-ink-3 sm:max-w-none">{single ? piggySummary(single) ?? (group.outsideOverall ? "fora do saldo geral" : "") : group.outsideOverall ? "fora do saldo geral" : "total na instituição"}</span>
        </span>
      )}
    </>
  );
  return (
    <li className="rounded-[var(--radius-xl)] border border-line bg-surface p-1.5">
      {single ? (
        <button type="button" onClick={() => openAccountDetails(single.account.id)} className="flex w-full items-center gap-3 rounded-[var(--radius-lg)] p-2.5 text-left hover:bg-surface-2">
          {header}
        </button>
      ) : (
        <div className="flex items-center gap-3 p-2.5">{header}</div>
      )}
      {(group.rows.length > 1 || (single && single.piggies.length > 0) || group.cards.length > 0) && (
        <ul className="grid">
          {group.rows.length > 1 &&
            group.rows.map((row) => (
              <React.Fragment key={row.account.id}>
                <li>
                  <button type="button" onClick={() => openAccountDetails(row.account.id)} className="flex w-full items-center gap-3 rounded-[var(--radius-md)] py-2 pl-3 pr-3 text-left hover:bg-surface-2 sm:pl-14">
                    <Landmark className="size-4 shrink-0 text-ink-3" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5 text-sm">
                        <span className="truncate">{row.account.name || (row.account.type ? ACCOUNT_TYPE_SHORT[row.account.type] : "Conta")}</span>
                        <Marks account={row.account} />
                      </span>
                      <span className="block text-xs text-ink-3">
                        {row.account.type ? ACCOUNT_TYPE_SHORT[row.account.type] : ""}
                        {piggySummary(row) && <> · {piggySummary(row)}</>}
                      </span>
                    </span>
                    <Money value={row.total} className="text-sm font-medium" tone={row.total < 0 ? "negative" : "neutral"} />
                  </button>
                </li>
                {row.piggies.map((p) => (
                  <PiggyRow key={p.id} piggy={p} />
                ))}
              </React.Fragment>
            ))}
          {single && single.piggies.map((p) => <PiggyRow key={p.id} piggy={p} />)}
          {group.cards.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => openCardDetails(c.id)} className="flex w-full items-center gap-3 rounded-[var(--radius-md)] py-2 pl-3 pr-3 text-left hover:bg-surface-2 sm:pl-14">
                <CreditCard className="size-4 shrink-0 text-ink-3" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{c.displayName}</span>
                  <span className="block truncate text-xs text-ink-3">{cardPhrase(c)}</span>
                </span>
                <Badge tone={c.invoiceSummary.state === "CLOSED" ? "warning" : c.invoiceSummary.state === "PAID" ? "positive" : "neutral"}>
                  {c.invoiceSummary.state === "OPEN" ? "Aberta" : c.invoiceSummary.state === "CLOSED" ? "Fechada" : "Paga"}
                </Badge>
              </button>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

/* ───────── page ───────── */

export function AccountsView() {
  const accountsQ = useAccounts();
  const overall = useOverallBalance();
  const cardsQ = useCards();
  const { data: institutions = [] } = useInstitutions();
  const [view, setView] = React.useState<"institution" | "type">("institution");
  const [showArchived, setShowArchived] = React.useState(false);
  const accounts = React.useMemo(() => accountsQ.data ?? [], [accountsQ.data]);
  const archivedCount = accounts.filter((a) => !a.active).length;
  const activeCount = accounts.filter((a) => a.active).length;

  const groups = React.useMemo(() => groupByInstitution(accounts, cardsQ.data ?? [], institutions, showArchived), [accounts, cardsQ.data, institutions, showArchived]);
  const sections = React.useMemo(() => groupByType(accounts, showArchived), [accounts, showArchived]);

  return (
    <div className="grid gap-7">
      <PageHeader
        eyebrow="Patrimônio"
        title="Contas"
        description="Contas, cofrinhos, investimentos e cartões em um só lugar."
        actions={
          <Button variant="primary" onClick={() => openNewAccountWizard()}>
            <Plus aria-hidden /> Nova conta
          </Button>
        }
      />
      {overall.isPending ? <div className="skeleton h-40 rounded-[var(--radius-2xl)]" /> : overall.isSuccess ? <OverallBalance data={overall.data} /> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="Agrupar"
          value={view}
          onValueChange={setView}
          options={[
            { value: "institution", label: "Por instituição" },
            { value: "type", label: "Por tipo" },
          ]}
        />
        {archivedCount > 0 && (
          <button type="button" onClick={() => setShowArchived((s) => !s)} aria-pressed={showArchived} className="text-sm text-ink-3 hover:text-ink">
            {archivedCount} {archivedCount === 1 ? "arquivada" : "arquivadas"} · <span className="font-medium text-ink underline decoration-line-strong underline-offset-4">{showArchived ? "Ocultar arquivadas" : "Mostrar arquivadas"}</span>
          </button>
        )}
      </div>

      {accountsQ.isPending ? (
        <ListSkeleton rows={6} />
      ) : accountsQ.isError ? (
        <ErrorState onRetry={() => accountsQ.refetch()} retrying={accountsQ.isFetching} />
      ) : accounts.length === 0 ? (
        <EmptyState icon={<Landmark />} title="Nenhuma conta cadastrada" message="Comece pela conta onde seu salário cai." action={<Button variant="primary" onClick={() => openNewAccountWizard()}><Plus aria-hidden /> Nova conta</Button>} />
      ) : activeCount === 0 && !showArchived ? (
        <EmptyState icon={<Landmark />} title="Nenhuma conta ativa" message="Todas as suas contas estão arquivadas." action={<Button onClick={() => setShowArchived(true)}>Mostrar arquivadas</Button>} />
      ) : view === "institution" ? (
        <ul className="grid gap-3 lg:grid-cols-2 lg:items-start">
          {groups.map((g) => (
            <GroupBlock key={g.key} group={g} />
          ))}
        </ul>
      ) : (
        <div className="grid gap-6">
          {sections.map((s) => (
            <section key={s.group} aria-labelledby={`sec-${s.group}`}>
              <div className="mb-2 flex items-baseline justify-between px-1">
                <h2 id={`sec-${s.group}`} className="text-[15px] font-semibold">
                  {GROUP_LABEL[s.group]}
                </h2>
                <Money value={s.total} className="text-sm font-semibold" />
              </div>
              <ul className="divide-y divide-line rounded-[var(--radius-xl)] border border-line bg-surface">
                {s.items.map((a) => {
                  const inst = institutionNameOf(a, institutions);
                  const parent = a.primaryAccountId ? accounts.find((x) => x.id === a.primaryAccountId) : undefined;
                  const label = parent ? `${parent.displayName} › ${a.displayName}` : inst && normalize(inst) !== normalize(a.displayName) ? `${inst} › ${a.displayName}` : a.displayName;
                  return (
                    <li key={a.id}>
                      <button type="button" onClick={() => openAccountDetails(a.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2">
                        <InstitutionLogo institutionId={a.institutionId} name={a.institutionName ?? a.displayName} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{label}</span>
                          <span className="flex gap-1.5">
                            {!a.active && <Badge tone="warning">Arquivada</Badge>}
                            {s.group !== "BENEFITS" && !a.countsForOverallBalance && a.primaryAccountId == null && <Badge tone="outline">Fora do saldo geral</Badge>}
                          </span>
                        </span>
                        <Money value={a.balance} className="text-sm font-semibold" tone={a.balance < 0 ? "negative" : "neutral"} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
