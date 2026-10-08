"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Segmented } from "@/components/ui/segmented";
import { CategoryIcon } from "@/components/shared/category-icon";
import { InstitutionLogo } from "@/components/shared/institution-logo";
import { accountOptionLabel } from "@/domain/accounts-view";
import { EMPTY_FILTERS, type DoneFilter, type ReleaseFilters, type TypeFilter } from "@/domain/cash-flow";
import type { Id } from "@/domain/types";
import { useInstitutions } from "@/features/institutions/queries";
import { usePicklists } from "@/features/picklists/queries";
import { cn } from "@/lib/utils";

interface FiltersDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  value: ReleaseFilters;
  onApply: (f: ReleaseFilters) => void;
}

function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

/** Cash-flow filters (§4.10): applied locally over the loaded month. */
export function FiltersDialog({ open, onOpenChange, value, onApply }: FiltersDialogProps) {
  const { accounts, cards, categories } = usePicklists();
  const { data: institutions = [] } = useInstitutions();
  // The parent re-mounts this dialog on open, so the draft always starts from the applied filters.
  const [draft, setDraft] = React.useState(value);

  const set = (patch: Partial<ReleaseFilters>) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Filtrar lançamentos"
      size="lg"
      footer={
        <div className="flex gap-2">
          <Button className="flex-1 sm:flex-none" onClick={() => setDraft(EMPTY_FILTERS)}>
            Limpar
          </Button>
          <Button
            variant="primary"
            className="flex-1 sm:ml-auto sm:flex-none"
            onClick={() => {
              onApply(draft);
              onOpenChange(false);
            }}
          >
            Filtrar
          </Button>
        </div>
      }
    >
      <div className="grid gap-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <span className="text-[13px] font-medium text-ink-2">Tipo</span>
            <Segmented<TypeFilter>
              label="Tipo"
              stretch
              size="sm"
              value={draft.type}
              onValueChange={(type) => set({ type })}
              options={[
                { value: "ALL", label: "Todos" },
                { value: "E", label: "Despesas" },
                { value: "R", label: "Receitas" },
                { value: "T", label: "Transf." },
              ]}
            />
          </div>
          <div className="grid gap-1.5">
            <span className="text-[13px] font-medium text-ink-2">Realizado</span>
            <Segmented<DoneFilter>
              label="Realizado"
              stretch
              size="sm"
              value={draft.done}
              onValueChange={(done) => set({ done })}
              options={[
                { value: "ALL", label: "Todos" },
                { value: "YES", label: "Sim" },
                { value: "NO", label: "Não" },
              ]}
            />
          </div>
        </div>
        <Field label="Descrição ou categoria contém" htmlFor="flt-desc" counter={{ value: draft.description.length, max: 50 }}>
          <Input id="flt-desc" maxLength={50} value={draft.description} onChange={(e) => set({ description: e.target.value })} />
        </Field>

        <CheckGroup title="Contas" count={draft.accountIds.length} onClear={() => set({ accountIds: [] })}>
          {accounts
            .filter((a) => a.active)
            .map((a) => (
              <CheckItem key={a.id} checked={draft.accountIds.includes(a.id)} onChange={() => set({ accountIds: toggle(draft.accountIds, a.id) })} indent={a.primaryAccountId != null}>
                <InstitutionLogo institutionId={a.institutionId} name={a.displayName} size="xs" />
                {accountOptionLabel(a, accounts, institutions)}
              </CheckItem>
            ))}
        </CheckGroup>

        {cards.some((c) => c.active) && (
          <CheckGroup title="Cartões" count={draft.cardIds.length} onClear={() => set({ cardIds: [] })}>
            {cards
              .filter((c) => c.active)
              .map((c) => (
                <CheckItem key={c.id} checked={draft.cardIds.includes(c.id)} onChange={() => set({ cardIds: toggle(draft.cardIds, c.id as Id) })}>
                  <InstitutionLogo institutionId={c.institutionId} name={c.displayName} size="xs" />
                  {c.displayName}
                </CheckItem>
              ))}
          </CheckGroup>
        )}

        {(["E", "R"] as const).map((type) => (
          <CheckGroup
            key={type}
            title={type === "E" ? "Categorias de despesa" : "Categorias de receita"}
            count={draft.categoryKeys.filter((k) => categories.some((c) => c.type === type && (k === `cat-${c.id}` || c.subcategories.some((s) => k === `sub-${s.id}`)))).length}
            onClear={() => set({ categoryKeys: draft.categoryKeys.filter((k) => !categories.some((c) => c.type === type && (k === `cat-${c.id}` || c.subcategories.some((s) => k === `sub-${s.id}`)))) })}
          >
            {categories
              .filter((c) => c.type === type)
              .flatMap((c) => [
                <CheckItem key={`c${c.id}`} checked={draft.categoryKeys.includes(`cat-${c.id}`)} onChange={() => set({ categoryKeys: toggle(draft.categoryKeys, `cat-${c.id}`) })}>
                  <CategoryIcon icon={c.icon} color={c.color} size="xs" />
                  {c.name}
                </CheckItem>,
                ...c.subcategories.map((s) => (
                  <CheckItem key={`s${s.id}`} indent checked={draft.categoryKeys.includes(`sub-${s.id}`)} onChange={() => set({ categoryKeys: toggle(draft.categoryKeys, `sub-${s.id}`) })}>
                    {s.name}
                  </CheckItem>
                )),
              ])}
          </CheckGroup>
        ))}
      </div>
    </Modal>
  );
}

function CheckGroup({ title, count, onClear, children }: { title: string; count: number; onClear: () => void; children: React.ReactNode }) {
  const [expanded, setExpanded] = React.useState(count > 0);
  const id = React.useId();
  return (
    <fieldset className="rounded-[var(--radius-lg)] border border-line">
      <legend className="sr-only">{title}</legend>
      <div className="flex items-center justify-between px-3 py-2">
        <button type="button" aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded((e) => !e)} className="flex flex-1 items-center gap-2 text-left text-sm font-medium">
          {title}
          {count > 0 && <span className="rounded-full bg-ink px-1.5 text-[11px] text-bg">{count}</span>}
        </button>
        {count > 0 && (
          <Button size="xs" variant="ghost" onClick={onClear}>
            Limpar
          </Button>
        )}
      </div>
      <div id={id} hidden={!expanded} className="scrollbar-thin grid max-h-64 gap-0.5 overflow-y-auto border-t border-line p-1.5 sm:grid-cols-2">
        {children}
      </div>
    </fieldset>
  );
}

function CheckItem({ checked, onChange, children, indent }: { checked: boolean; onChange: () => void; children: React.ReactNode; indent?: boolean }) {
  return (
    <label className={cn("flex min-h-9 cursor-pointer items-center gap-2.5 rounded-[var(--radius-sm)] px-2 text-sm hover:bg-surface-2", indent && "pl-7 text-ink-2")}>
      <Checkbox checked={checked} onCheckedChange={onChange} />
      {children}
    </label>
  );
}
