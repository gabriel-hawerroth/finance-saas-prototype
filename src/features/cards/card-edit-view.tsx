"use client";
import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Building2, ChevronRight, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { OptionPicker } from "@/components/ui/option-picker";
import { Select } from "@/components/ui/select";
import { AuditInfo } from "@/components/shared/audit-info";
import { ErrorState, ListSkeleton } from "@/components/shared/content-state";
import { InstitutionLogo } from "@/components/shared/institution-logo";
import { Panel } from "@/components/shared/page-header";
import { api } from "@/data/api";
import { qk } from "@/data/query-keys";
import { invalidateFinancial } from "@/data/sync";
import { isUnusualGap } from "@/domain/card-cycle";
import { ApiError } from "@/domain/errors";
import type { CreditCard } from "@/domain/types";
import { openInstitutionPicker } from "@/features/institutions/institution-picker";
import { useInstitutions } from "@/features/institutions/queries";
import { useAccounts } from "@/features/picklists/queries";
import { usePrefs } from "@/features/prefs/store";
import { accountPickerOptions } from "@/features/releases/options";
import { askCycleChange } from "./cycle-change-dialog";
import { DAY_OPTIONS } from "./new-card-wizard";

/** Card editing (§4.14) with cycle-change simulation before saving. */
export function CardEditView() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = Number(params.id);
  const q = useQuery({ queryKey: qk.card(id), queryFn: () => api.cards.get(id), enabled: Number.isInteger(id) });
  React.useEffect(() => {
    if (q.isError) {
      toast.error("Não foi possível carregar o cartão.");
      router.back();
    }
  }, [q.isError, router]);
  return (
    <div className="mx-auto grid max-w-2xl gap-6">
      <Button variant="ghost" size="sm" className="-ml-2 w-fit" onClick={() => router.push("/cartoes-de-credito")}>
        <ArrowLeft aria-hidden /> Cartões
      </Button>
      {q.isPending ? <ListSkeleton rows={5} /> : q.isError ? <ErrorState onRetry={() => q.refetch()} /> : <CardForm card={q.data} />}
    </div>
  );
}

function CardForm({ card }: { card: CreditCard }) {
  const qc = useQueryClient();
  const router = useRouter();
  const currency = usePrefs((s) => s.currency);
  const { data: institutions = [] } = useInstitutions();
  const { data: accounts = [] } = useAccounts();
  const [name, setName] = React.useState(card.name ?? "");
  const [limit, setLimit] = React.useState(card.cardLimit);
  const [closeDay, setCloseDay] = React.useState(card.closeDay);
  const [dueDay, setDueDay] = React.useState(card.invoiceDueDay);
  const [institutionId, setInstitutionId] = React.useState(card.institutionId ?? null);
  const [account, setAccount] = React.useState(`acc-${card.standardPaymentAccountId}`);
  const [saving, setSaving] = React.useState(false);
  const [showErrors, setShowErrors] = React.useState(false);
  const inst = institutions.find((i) => i.id === institutionId);
  const errors = {
    name: !institutionId && !name.trim() ? "Informe um nome (o cartão não tem banco)." : undefined,
    limit: !(limit > 0) ? "O limite deve ser maior que zero." : undefined,
    account: !account ? "Escolha a conta de pagamento." : undefined,
  };

  const save = async () => {
    setShowErrors(true);
    if (Object.values(errors).some(Boolean)) {
      if (errors.limit) toast.warning(errors.limit);
      return;
    }
    setSaving(true);
    try {
      if (closeDay !== card.closeDay || dueDay !== card.invoiceDueDay) {
        try {
          const sim = await api.cards.simulateCycleChange(card.id, closeDay, dueDay);
          if (sim.invoices.length > 0 && !(await askCycleChange(sim, "card"))) return;
        } catch (e) {
          if (!(e instanceof ApiError && e.status === 404)) {
            toast.error("Não foi possível simular a mudança de ciclo.");
            return;
          }
        }
      }
      await api.cards.update(card.id, { name: name.trim() || null, cardLimit: limit, closeDay, invoiceDueDay: dueDay, institutionId, standardPaymentAccountId: Number(account.split("-")[1]) });
      toast.success("Cartão atualizado");
      void invalidateFinancial(qc);
      router.push("/cartoes-de-credito");
    } catch {
      toast.error("Não foi possível salvar o cartão.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-6">
      <h1 className="font-display text-[40px] leading-none">Editar cartão</h1>
      <Panel className="grid gap-5 p-5 sm:p-6">
        <div className="grid gap-1.5">
          <span className="text-[13px] font-medium text-ink-2">Banco</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={async () => {
                const r = await openInstitutionPicker({ allowOther: false, allowWallet: false });
                if (r?.institutionId) setInstitutionId(r.institutionId);
              }}
              className="flex h-12 flex-1 items-center gap-3 rounded-[var(--radius-md)] border border-line-strong px-3 text-left hover:border-ink-3"
            >
              {inst ? <InstitutionLogo institutionId={inst.id} size="sm" /> : <Building2 className="size-5 text-ink-3" aria-hidden />}
              <span className="flex-1 text-sm">{inst?.name ?? "Sem banco"}</span>
              <ChevronRight className="size-4 text-ink-3" aria-hidden />
            </button>
            {inst && (
              <Button variant="ghost" size="icon" className="h-12" aria-label="Remover banco" onClick={() => setInstitutionId(null)}>
                <X />
              </Button>
            )}
          </div>
        </div>
        <Field label="Nome" htmlFor="ce-name" optional={Boolean(inst)} error={showErrors ? errors.name : undefined} counter={{ value: name.length, max: 40 }}>
          <Input id="ce-name" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder={inst?.name} />
        </Field>
        <Field label="Limite" htmlFor="ce-limit" error={showErrors ? errors.limit : undefined}>
          <MoneyInput id="ce-limit" currency={currency} value={limit} onValueChange={setLimit} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fechamento" htmlFor="ce-close">
            <Select id="ce-close" value={String(closeDay)} onValueChange={(v) => setCloseDay(Number(v))} options={DAY_OPTIONS} />
          </Field>
          <Field label="Vencimento" htmlFor="ce-due">
            <Select id="ce-due" value={String(dueDay)} onValueChange={(v) => setDueDay(Number(v))} options={DAY_OPTIONS} />
          </Field>
        </div>
        {isUnusualGap(closeDay, dueDay) && <p className="rounded-[var(--radius-lg)] bg-warning-soft px-3.5 py-3 text-[13px] text-ink-2">A folga entre fechamento e vencimento está fora do comum (1 a 15 dias).</p>}
        <Field label="Conta de pagamento padrão" htmlFor="ce-acc" error={showErrors ? errors.account : undefined}>
          <OptionPicker id="ce-acc" value={account} onValueChange={setAccount} groups={[{ options: accountPickerOptions(accounts, institutions, { topOnly: true }) }]} />
        </Field>
        <div className="flex items-center justify-between border-t border-line pt-4 text-sm">
          <span className="text-ink-2">Situação</span>
          <Badge tone={card.active ? "positive" : "warning"} size="md">
            {card.active ? "Ativo" : "Arquivado"}
          </Badge>
        </div>
        <p className="-mt-3 text-xs text-ink-3">A situação é alterada nos detalhes do cartão.</p>
        <AuditInfo createdAt={card.createdAt} updatedAt={card.updatedAt} />
      </Panel>
      <div className="flex justify-end gap-2">
        <Button onClick={() => router.back()}>Voltar</Button>
        <Button variant="primary" onClick={save} loading={saving}>
          Salvar
        </Button>
      </div>
    </div>
  );
}
