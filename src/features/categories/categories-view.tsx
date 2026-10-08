"use client";
import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRightLeft, ChevronDown, LayoutGrid, List, Pencil, Plus, Search, Tags, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { CategoryIcon } from "@/components/shared/category-icon";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/shared/content-state";
import { PageHeader } from "@/components/shared/page-header";
import { api } from "@/data/api";
import { qk } from "@/data/query-keys";
import type { CategoryType, CategoryWithSubs } from "@/domain/types";
import { useCategories } from "@/features/picklists/queries";
import { usePrefs } from "@/features/prefs/store";
import { useIsMobile } from "@/hooks/use-media-query";
import { includesNormalized } from "@/lib/text";
import { cn } from "@/lib/utils";
import { deleteCategoryFlow, openCategoryForm, openMoveReleases, openSubcategoryForm } from "./category-dialogs";

export function CategoriesView() {
  const q = useCategories();
  const [type, setType] = React.useState<CategoryType>("E");
  const [search, setSearch] = React.useState("");
  const [openId, setOpenId] = React.useState<number | null>(null);
  const viewPref = usePrefs((s) => s.categoriesView);
  const set = usePrefs((s) => s.set);
  const isMobile = useIsMobile();
  const view = isMobile ? "list" : viewPref;
  const list = (q.data ?? []).filter((c) => c.type === type && includesNormalized(c.name, search));

  return (
    <div className="grid gap-7">
      <PageHeader
        eyebrow="Organização"
        title="Categorias"
        description="Toque numa categoria para ver as subcategorias."
        actions={
          <>
            <Button onClick={() => openMoveReleases(q.data ?? [])} disabled={!q.data}>
              <ArrowRightLeft aria-hidden /> Mover lançamentos
            </Button>
            <Button variant="primary" onClick={() => openCategoryForm({ type })}>
              <Plus aria-hidden /> Nova
            </Button>
          </>
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          label="Tipo"
          value={type}
          onValueChange={(t) => {
            setType(t);
            setOpenId(null);
          }}
          options={[
            { value: "E", label: "Despesas" },
            { value: "R", label: "Receitas" },
          ]}
        />
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar categoria" aria-label="Buscar categoria" className="pl-9" />
        </div>
        <Segmented
          label="Modo de exibição"
          className="ml-auto hidden md:inline-flex"
          value={viewPref}
          onValueChange={(v) => set({ categoriesView: v })}
          options={[
            { value: "grid", label: <span className="sr-only">Grade</span>, icon: <LayoutGrid aria-hidden /> },
            { value: "list", label: <span className="sr-only">Lista</span>, icon: <List aria-hidden /> },
          ]}
        />
      </div>

      {q.isPending ? (
        <ListSkeleton rows={8} />
      ) : q.isError ? (
        <ErrorState onRetry={() => q.refetch()} retrying={q.isFetching} />
      ) : list.length === 0 ? (
        <EmptyState icon={<Tags />} title={search ? "Nenhuma categoria encontrada" : "Nenhuma categoria"} action={!search ? <Button variant="primary" onClick={() => openCategoryForm({ type })}><Plus aria-hidden /> Nova categoria</Button> : undefined} />
      ) : (
        <ul className={cn(view === "grid" ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-3" : "grid gap-2")}>
          {list.map((c) => (
            <CategoryItem key={c.id} category={c} open={openId === c.id} onToggle={() => setOpenId((o) => (o === c.id ? null : c.id))} grid={view === "grid"} />
          ))}
        </ul>
      )}
    </div>
  );
}

function CategoryItem({ category: c, open, onToggle, grid }: { category: CategoryWithSubs; open: boolean; onToggle: () => void; grid: boolean }) {
  const qc = useQueryClient();
  const subsQ = useQuery({ queryKey: qk.subcategories(c.id), queryFn: () => api.categories.subcategories(c.id), enabled: open, staleTime: 60_000 });
  const panelId = `cat-panel-${c.id}`;
  return (
    <li className={cn("rounded-[var(--radius-xl)] border bg-surface transition-colors", open ? "border-line-strong" : "border-line", grid && open && "sm:col-span-2 xl:col-span-3")}>
      <h3>
        <button type="button" aria-expanded={open} aria-controls={panelId} onClick={onToggle} className="flex w-full items-center gap-3 rounded-[var(--radius-xl)] p-3 text-left hover:bg-surface-2">
          <CategoryIcon icon={c.icon} color={c.color} />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{c.name}</span>
            <span className="block text-xs text-ink-3">{c.subcategories.length ? `${c.subcategories.length} subcategorias` : "Sem subcategorias"}</span>
          </span>
          {c.essential && <Badge tone="brand">Essencial</Badge>}
          <ChevronDown className={cn("size-4 text-ink-3 transition-transform", open && "rotate-180")} aria-hidden />
        </button>
      </h3>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div id={panelId} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="border-t border-line px-3 pb-3 pt-2">
              {subsQ.isPending ? (
                <ListSkeleton rows={2} className="py-2" />
              ) : subsQ.isError ? (
                <ErrorState compact onRetry={() => subsQ.refetch()} />
              ) : subsQ.data.length === 0 ? (
                <p className="px-2 py-3 text-sm text-ink-3">Sem subcategorias.</p>
              ) : (
                <ul className={cn("grid gap-0.5", grid && "sm:grid-cols-2 xl:grid-cols-3")}>
                  {subsQ.data.map((s) => (
                    <li key={s.id} className="flex items-center gap-2 rounded-[var(--radius-md)] py-1 pl-3 pr-1 hover:bg-surface-2">
                      <span className="size-1.5 rounded-full" style={{ backgroundColor: c.color }} aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-sm">{s.name}</span>
                      {s.essential && <Badge tone="brand">Essencial</Badge>}
                      <Button variant="ghost" size="icon-xs" aria-label={`Editar ${s.name}`} onClick={() => openSubcategoryForm({ category: c, subcategory: s })}>
                        <Pencil />
                      </Button>
                      <Button variant="ghost" size="icon-xs" aria-label={`Excluir ${s.name}`} onClick={() => deleteCategoryFlow(qc, { kind: "subcategory", item: s })}>
                        <Trash2 />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => openSubcategoryForm({ category: c })}>
                  <Plus aria-hidden /> Adicionar subcategoria
                </Button>
                <Button size="sm" variant="ghost" onClick={() => openCategoryForm({ type: c.type, category: c })}>
                  <Pencil aria-hidden /> Editar categoria
                </Button>
                <Button size="sm" variant="danger-ghost" onClick={() => deleteCategoryFlow(qc, { kind: "category", item: c })}>
                  <Trash2 aria-hidden /> Excluir categoria
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}
