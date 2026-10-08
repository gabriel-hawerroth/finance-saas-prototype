"use client";
import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal, ModalActions } from "@/components/ui/modal";
import { OptionPicker, type PickerGroup } from "@/components/ui/option-picker";
import { SwitchRow } from "@/components/ui/switch";
import { AuditInfo } from "@/components/shared/audit-info";
import { CategoryIcon, iconByName } from "@/components/shared/category-icon";
import { api } from "@/data/api";
import { invalidateFinancial } from "@/data/sync";
import { CATEGORY_COLORS, CATEGORY_ICONS, PROTECTED_CATEGORY_NAMES } from "@/domain/constants";
import { isApiError } from "@/domain/errors";
import type { Category, CategoryType, CategoryWithSubs, Subcategory } from "@/domain/types";
import { confirm } from "@/features/overlays/dialogs";
import { openOverlay } from "@/features/overlays/store";
import { cn } from "@/lib/utils";

/* ───────── category form ───────── */

export function openCategoryForm(opts: { type: CategoryType; category?: Category }) {
  openOverlay((close) => <CategoryForm {...opts} onClose={close} />);
}

function CategoryForm({ type, category, onClose }: { type: CategoryType; category?: Category; onClose: () => void }) {
  const qc = useQueryClient();
  const locked = category ? PROTECTED_CATEGORY_NAMES.includes(category.name) : false;
  const [name, setName] = React.useState(category?.name ?? "");
  const [color, setColor] = React.useState(category?.color ?? CATEGORY_COLORS[8]);
  const [icon, setIcon] = React.useState(category?.icon ?? "ShoppingBag");
  const [essential, setEssential] = React.useState(category?.essential ?? false);
  const [saving, setSaving] = React.useState(false);
  const changed = !category || name !== category.name || color !== category.color || icon !== category.icon || essential !== category.essential;
  const nameError = name.length > 40 ? "Use no máximo 40 caracteres." : undefined;
  const valid = name.trim().length > 0 && !nameError;

  const save = async () => {
    setSaving(true);
    try {
      const dto = { name: name.trim(), color, icon, type, essential: type === "E" && essential };
      if (category) await api.categories.update(category.id, dto);
      else await api.categories.create(dto);
      toast.success(category ? "Categoria atualizada" : "Categoria criada");
      void invalidateFinancial(qc);
      onClose();
    } catch {
      toast.error("Não foi possível salvar a categoria.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={category ? "Editar categoria" : type === "E" ? "Nova categoria de despesa" : "Nova categoria de receita"}
      size="lg"
      leading={<CategoryIcon icon={icon} color={color} />}
      footer={
        <ModalActions>
          <Button onClick={onClose}>{locked ? "Fechar" : "Cancelar"}</Button>
          {!locked && (
            <Button variant="primary" onClick={save} loading={saving} disabled={!valid || !changed}>
              Salvar
            </Button>
          )}
        </ModalActions>
      }
    >
      <fieldset disabled={locked} className="grid gap-5">
        {locked && (
          <p className="flex items-center gap-2 rounded-[var(--radius-lg)] bg-surface-2 px-3.5 py-3 text-[13px] text-ink-2">
            <Lock className="size-4 text-ink-3" aria-hidden /> Categoria padrão do sistema: não pode ser alterada.
          </p>
        )}
        <Field label="Nome" htmlFor="cat-name" error={nameError} counter={{ value: name.length, max: 40 }}>
          <Input id="cat-name" autoFocus value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="grid gap-2" role="radiogroup" aria-label="Cor">
          <span className="text-[13px] font-medium text-ink-2">Cor</span>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={color === c}
                aria-label={`Cor ${c}`}
                onClick={() => setColor(c)}
                className={cn("grid size-8 place-items-center rounded-full ring-offset-2 ring-offset-surface transition-shadow", color === c && "ring-2 ring-ink")}
                style={{ backgroundColor: c }}
              >
                {color === c && <Check className="size-4 text-white" strokeWidth={3} aria-hidden />}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-2" role="radiogroup" aria-label="Ícone">
          <span className="text-[13px] font-medium text-ink-2">Ícone</span>
          <div className="scrollbar-thin grid max-h-52 grid-cols-[repeat(auto-fill,minmax(40px,1fr))] gap-1.5 overflow-y-auto rounded-[var(--radius-lg)] border border-line p-2">
            {CATEGORY_ICONS.map((name) => {
              const Icon = iconByName(name);
              return (
                <button
                  key={name}
                  type="button"
                  role="radio"
                  aria-checked={icon === name}
                  aria-label={name}
                  onClick={() => setIcon(name)}
                  className={cn("grid size-10 place-items-center rounded-[10px] text-ink-2 hover:bg-surface-2", icon === name && "bg-ink text-bg hover:bg-ink")}
                >
                  <Icon className="size-[18px]" aria-hidden />
                </button>
              );
            })}
          </div>
        </div>
        {type === "E" && <SwitchRow id="cat-ess" label="Essencial" hint="Gastos essenciais aparecem separados no painel inicial." checked={essential} onCheckedChange={setEssential} />}
        {category && <AuditInfo createdAt={category.createdAt} updatedAt={category.updatedAt} />}
      </fieldset>
    </Modal>
  );
}

/* ───────── subcategory form ───────── */

export function openSubcategoryForm(opts: { category: Category; subcategory?: Subcategory }) {
  openOverlay((close) => <SubcategoryForm {...opts} onClose={close} />);
}

function SubcategoryForm({ category, subcategory, onClose }: { category: Category; subcategory?: Subcategory; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = React.useState(subcategory?.name ?? "");
  const [essential, setEssential] = React.useState(subcategory?.essential ?? category.essential);
  const [saving, setSaving] = React.useState(false);
  const save = async () => {
    setSaving(true);
    try {
      if (subcategory) await api.categories.updateSub(subcategory.id, { name: name.trim(), essential });
      else await api.categories.createSub({ name: name.trim(), essential, categoryId: category.id });
      toast.success(subcategory ? "Subcategoria atualizada" : "Subcategoria criada");
      void invalidateFinancial(qc);
      onClose();
    } catch {
      toast.error("Não foi possível salvar a subcategoria.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={subcategory ? "Editar subcategoria" : "Nova subcategoria"}
      description={`Em ${category.name}`}
      size="sm"
      footer={
        <ModalActions>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={save} loading={saving} disabled={!name.trim() || name.length > 40 || (subcategory && name === subcategory.name && essential === subcategory.essential)}>
            Salvar
          </Button>
        </ModalActions>
      }
    >
      <div className="grid gap-4">
        <Field label="Nome" htmlFor="sub-name" counter={{ value: name.length, max: 40 }}>
          <Input id="sub-name" autoFocus maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        {category.type === "E" && <SwitchRow id="sub-ess" label="Essencial" checked={essential} onCheckedChange={setEssential} />}
        {subcategory && <AuditInfo createdAt={subcategory.createdAt} updatedAt={subcategory.updatedAt} />}
      </div>
    </Modal>
  );
}

/* ───────── delete (with archive fallback) ───────── */

export async function deleteCategoryFlow(qc: ReturnType<typeof useQueryClient>, target: { kind: "category"; item: Category } | { kind: "subcategory"; item: Subcategory }): Promise<void> {
  const isCat = target.kind === "category";
  if (!(await confirm({ message: `Excluir ${isCat ? "a categoria" : "a subcategoria"} “${target.item.name}”?`, confirmLabel: "Excluir", tone: "danger" }))) return;
  try {
    if (isCat) await api.categories.remove(target.item.id);
    else await api.categories.removeSub(target.item.id);
    toast.success("Excluída");
    void invalidateFinancial(qc);
  } catch (error) {
    if (!isApiError(error, "LINKED_RELEASES")) {
      toast.error("Não foi possível excluir.");
      return;
    }
    const ok = await confirm({
      title: "Existem lançamentos vinculados",
      message: isCat ? "Não dá para excluir porque há lançamentos nesta categoria. Deseja arquivá-la? Suas subcategorias também serão arquivadas." : "Não dá para excluir porque há lançamentos nesta subcategoria. Deseja arquivá-la?",
      confirmLabel: "Arquivar",
    });
    if (!ok) return;
    try {
      if (isCat) await api.categories.inactivate(target.item.id);
      else await api.categories.inactivateSub(target.item.id);
      toast.success("Arquivada");
      void invalidateFinancial(qc);
    } catch {
      toast.error("Não foi possível arquivar.");
    }
  }
}

/* ───────── move releases (§5.15) ───────── */

export function openMoveReleases(categories: CategoryWithSubs[]) {
  openOverlay((close) => <MoveReleases categories={categories} onClose={close} />);
}

function pickerGroups(categories: CategoryWithSubs[]): PickerGroup[] {
  return (["E", "R"] as const).map((type) => ({
    label: type === "E" ? "Despesas" : "Receitas",
    options: categories
      .filter((c) => c.type === type)
      .flatMap((c) => [
        { value: `cat-${c.id}`, label: c.name, leading: <CategoryIcon icon={c.icon} color={c.color} size="xs" /> },
        ...c.subcategories.map((s) => ({ value: `sub-${s.id}`, label: s.name, hint: c.name, indent: true, keywords: [c.name] })),
      ]),
  }));
}

function MoveReleases({ categories, onClose }: { categories: CategoryWithSubs[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [source, setSource] = React.useState("");
  const [target, setTarget] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [showErrors, setShowErrors] = React.useState(false);
  const resolve = (key: string) => {
    const [kind, idStr] = key.split("-");
    const id = Number(idStr);
    if (kind === "cat") {
      const c = categories.find((x) => x.id === id);
      return c ? { categoryId: c.id, subcategoryId: null, type: c.type, label: c.name } : null;
    }
    const c = categories.find((x) => x.subcategories.some((s) => s.id === id));
    const s = c?.subcategories.find((x) => x.id === id);
    return c && s ? { categoryId: c.id, subcategoryId: s.id, type: c.type, label: `${c.name} › ${s.name}` } : null;
  };
  const src = source ? resolve(source) : null;
  const dst = target ? resolve(target) : null;
  const error = !src || !dst ? "Escolha a origem e o destino." : src.type !== dst.type ? "Origem e destino precisam ser do mesmo tipo (despesa ou receita)." : source === target ? "Origem e destino são iguais." : null;

  const move = async () => {
    setShowErrors(true);
    if (error || !src || !dst) return;
    setSaving(true);
    try {
      const n = await api.categories.moveReleases({ sourceCategoryId: src.categoryId, sourceSubcategoryId: src.subcategoryId, targetCategoryId: dst.categoryId, targetSubcategoryId: dst.subcategoryId });
      toast.success(n === 0 ? "Nenhum lançamento para mover" : n === 1 ? "1 lançamento movido" : `${n} lançamentos movidos`);
      // Improvement over the reference app: every screen refreshes after a move.
      void invalidateFinancial(qc);
      onClose();
    } catch {
      toast.error("Não foi possível mover os lançamentos.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title="Mover lançamentos"
      description="Reorganize lançamentos entre categorias do mesmo tipo."
      size="md"
      footer={
        <ModalActions>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={move} loading={saving}>
            Mover
          </Button>
        </ModalActions>
      }
    >
      <div className="grid gap-4">
        <Field label="De" htmlFor="mv-src">
          <OptionPicker id="mv-src" value={source} onValueChange={setSource} groups={pickerGroups(categories)} searchPlaceholder="Buscar categoria" />
        </Field>
        <Field label="Para" htmlFor="mv-dst">
          <OptionPicker id="mv-dst" value={target} onValueChange={setTarget} groups={pickerGroups(categories)} searchPlaceholder="Buscar categoria" />
        </Field>
        {showErrors && error && (
          <p role="alert" className="text-[13px] text-negative">
            {error}
          </p>
        )}
        <p className="rounded-[var(--radius-lg)] bg-warning-soft px-3.5 py-3 text-sm text-ink-2">
          Todos os lançamentos de <strong className="font-medium">{src?.label ?? "…"}</strong> serão movidos para <strong className="font-medium">{dst?.label ?? "…"}</strong>. Essa ação não pode ser desfeita.
        </p>
      </div>
    </Modal>
  );
}
