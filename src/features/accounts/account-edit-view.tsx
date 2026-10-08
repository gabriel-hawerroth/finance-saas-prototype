"use client";
import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, Building2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SwitchRow } from "@/components/ui/switch";
import { AuditInfo } from "@/components/shared/audit-info";
import { ErrorState, ListSkeleton } from "@/components/shared/content-state";
import { InstitutionLogo } from "@/components/shared/institution-logo";
import { Panel } from "@/components/shared/page-header";
import { api } from "@/data/api";
import { qk } from "@/data/query-keys";
import { invalidateFinancial } from "@/data/sync";
import { ACCOUNT_TYPE_LABEL } from "@/domain/constants";
import type { AccountType, Id } from "@/domain/types";
import { openInstitutionPicker } from "@/features/institutions/institution-picker";
import { useInstitutions } from "@/features/institutions/queries";
import { typeHints } from "./new-account-wizard";

const TYPES: AccountType[] = ["CHECKING", "SAVING", "BROKERAGE", "BENEFIT", "CASH"];

const schema = z
  .object({
    institutionId: z.number().nullable(),
    institutionName: z.string().max(40).nullable(),
    type: z.enum(["CHECKING", "SAVING", "BROKERAGE", "BENEFIT", "CASH"], { message: "Escolha o tipo." }),
    name: z.string().max(40, "Use no máximo 40 caracteres."),
    accountNumber: z.string().max(15, "Use no máximo 15 caracteres."),
    agency: z.string().max(5, "Use no máximo 5 caracteres."),
    visibleInCashFlow: z.boolean(),
    countsForOverallBalance: z.boolean(),
  })
  .refine((v) => v.name.trim() || v.institutionId != null || v.institutionName, { path: ["name"], message: "Informe um nome ou escolha a instituição." });
type Values = z.infer<typeof schema>;

/** Account editing (§4.12). Balance is not editable here — use "Corrigir saldo". */
export function AccountEditView() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = Number(params.id);
  const valid = Number.isInteger(id) && id > 0;
  React.useEffect(() => {
    if (!valid) router.replace("/contas");
  }, [valid, router]);
  const q = useQuery({ queryKey: qk.account(id), queryFn: () => api.accounts.get(id), enabled: valid });

  return (
    <div className="mx-auto grid max-w-2xl gap-6">
      <Button variant="ghost" size="sm" className="-ml-2 w-fit" onClick={() => router.push("/contas")}>
        <ArrowLeft aria-hidden /> Contas
      </Button>
      {q.isPending ? <ListSkeleton rows={6} /> : q.isError ? <ErrorState onRetry={() => q.refetch()} /> : <AccountForm id={id} initial={q.data.account} />}
    </div>
  );
}

function AccountForm({ id, initial }: { id: Id; initial: Awaited<ReturnType<typeof api.accounts.get>>["account"] }) {
  const qc = useQueryClient();
  const router = useRouter();
  const { data: institutions = [] } = useInstitutions();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      institutionId: initial.institutionId ?? null,
      institutionName: initial.institutionName ?? null,
      type: (initial.type ?? "CHECKING") as AccountType,
      name: initial.name ?? "",
      accountNumber: initial.accountNumber ?? "",
      agency: initial.agency ?? "",
      visibleInCashFlow: initial.visibleInCashFlow,
      countsForOverallBalance: initial.countsForOverallBalance,
    },
  });
  const { register, control, handleSubmit, watch, setValue, formState } = form;
  const type = watch("type");
  const instId = watch("institutionId");
  const instName = watch("institutionName");
  const isCash = type === "CASH";
  const instLabel = instId != null ? institutions.find((i) => i.id === instId)?.name : instName;

  React.useEffect(() => {
    if (isCash) {
      setValue("accountNumber", "");
      setValue("agency", "");
    }
  }, [isCash, setValue]);

  const onSubmit = async (v: Values) => {
    try {
      await api.accounts.update(id, {
        name: v.name.trim() || null,
        type: v.type,
        institutionId: v.institutionId,
        institutionName: v.institutionId != null ? null : v.institutionName,
        accountNumber: v.accountNumber || null,
        agency: v.agency || null,
        visibleInCashFlow: v.visibleInCashFlow,
        countsForOverallBalance: v.countsForOverallBalance,
        purpose: initial.purpose,
        goal: initial.goal,
      });
      toast.success("Conta atualizada");
      void invalidateFinancial(qc);
      router.push("/contas");
    } catch {
      toast.error("Não foi possível salvar a conta.");
    }
  };

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="grid gap-6">
      <h1 className="font-display text-[40px] leading-none">Editar conta</h1>
      <Panel className="grid gap-5 p-5 sm:p-6">
        <div className="grid gap-1.5">
          <span className="text-[13px] font-medium text-ink-2">Instituição</span>
          <button
            type="button"
            onClick={async () => {
              const r = await openInstitutionPicker({ allowOther: true, allowWallet: true });
              if (!r) return;
              setValue("institutionId", r.institutionId ?? null, { shouldDirty: true });
              setValue("institutionName", r.institutionName ?? null, { shouldDirty: true });
              if (r.institutionId === 1) setValue("type", "CASH", { shouldDirty: true });
            }}
            className="flex h-12 items-center gap-3 rounded-[var(--radius-md)] border border-line-strong px-3 text-left hover:border-ink-3"
          >
            {instLabel ? <InstitutionLogo institutionId={instId} name={instLabel} size="sm" /> : <Building2 className="size-5 text-ink-3" aria-hidden />}
            <span className="flex-1 text-sm">{instLabel ?? "Escolher instituição"}</span>
            <ChevronRight className="size-4 text-ink-3" aria-hidden />
          </button>
        </div>
        <Field label="Tipo" htmlFor="ae-type" error={formState.errors.type?.message}>
          <Controller control={control} name="type" render={({ field }) => <Select id="ae-type" value={field.value} onValueChange={field.onChange} options={TYPES.map((t) => ({ value: t, label: ACCOUNT_TYPE_LABEL[t] }))} />} />
        </Field>
        <Field label="Nome" htmlFor="ae-name" optional={instLabel != null} error={formState.errors.name?.message} hint={`Ex.: ${ACCOUNT_TYPE_LABEL[type]}`} counter={{ value: watch("name").length, max: 40 }}>
          <Input id="ae-name" maxLength={40} {...register("name")} />
        </Field>
        <div className="grid grid-cols-[1fr_120px] gap-3">
          <Field label="Número da conta" htmlFor="ae-number" optional error={formState.errors.accountNumber?.message}>
            <Input id="ae-number" maxLength={15} disabled={isCash} {...register("accountNumber")} />
          </Field>
          <Field label="Agência" htmlFor="ae-agency" optional error={formState.errors.agency?.message}>
            <Input id="ae-agency" maxLength={5} disabled={isCash} {...register("agency")} />
          </Field>
        </div>
        <div className="grid gap-3 border-t border-line pt-4">
          <Controller control={control} name="visibleInCashFlow" render={({ field }) => <SwitchRow id="ae-flow" label="Visível no fluxo de caixa" hint={typeHints(type).flow} checked={field.value} onCheckedChange={field.onChange} />} />
          <Controller control={control} name="countsForOverallBalance" render={({ field }) => <SwitchRow id="ae-overall" label="Entra no saldo geral" hint={typeHints(type).overall} checked={field.value} onCheckedChange={field.onChange} />} />
        </div>
        <p className="text-[13px] text-ink-3">O saldo não é editado aqui. Para ajustar, use “Corrigir saldo” nos detalhes da conta.</p>
        <AuditInfo createdAt={initial.createdAt} updatedAt={initial.updatedAt} />
      </Panel>
      <div className="flex justify-end gap-2">
        <Button onClick={() => router.push("/contas")}>Voltar</Button>
        <Button type="submit" variant="primary" loading={formState.isSubmitting} disabled={!formState.isDirty}>
          Salvar
        </Button>
      </div>
    </form>
  );
}
