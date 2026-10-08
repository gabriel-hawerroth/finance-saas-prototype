"use client";
import { Badge } from "@/components/ui/badge";
import type { PickerGroup, PickerOption } from "@/components/ui/option-picker";
import { CategoryIcon } from "@/components/shared/category-icon";
import { InstitutionLogo } from "@/components/shared/institution-logo";
import { Money } from "@/components/shared/money";
import { accountOptionLabel } from "@/domain/accounts-view";
import type { Account, CategoryWithSubs, CreditCard, Id, Institution, RefName } from "@/domain/types";
import { CreditCard as CardIcon } from "lucide-react";

const archivedBadge = (female = true) => (
  <Badge tone="warning" className="shrink-0">
    {female ? "Arquivada" : "Arquivado"}
  </Badge>
);

export function accountPickerOptions(
  accounts: readonly Account[],
  institutions: readonly Institution[],
  opts: { topOnly?: boolean; excludeId?: Id | null; ghost?: RefName | null; prefix?: string } = {},
): PickerOption[] {
  const prefix = opts.prefix ?? "acc-";
  const list: PickerOption[] = accounts
    .filter((a) => a.active && (!opts.topOnly || a.primaryAccountId == null) && a.id !== opts.excludeId)
    .map((a) => ({
      value: `${prefix}${a.id}`,
      label: accountOptionLabel(a, accounts, institutions),
      leading: <InstitutionLogo institutionId={a.institutionId} name={a.institutionName ?? a.displayName} size="xs" />,
      badge: <Money value={a.balance} className="text-xs text-ink-3" />,
      indent: a.primaryAccountId != null,
      keywords: [a.displayName, a.institutionName ?? ""],
    }));
  if (opts.ghost && !opts.ghost.active && !list.some((o) => o.value === `${prefix}${opts.ghost!.id}`)) {
    list.unshift({ value: `${prefix}${opts.ghost.id}`, label: opts.ghost.name, badge: archivedBadge(), leading: <InstitutionLogo institutionId={opts.ghost.institutionId} name={opts.ghost.name} size="xs" /> });
  }
  return list;
}

export function cardPickerOptions(cards: readonly CreditCard[], ghost?: RefName | null): PickerOption[] {
  const list: PickerOption[] = cards
    .filter((c) => c.active)
    .map((c) => ({
      value: `card-${c.id}`,
      label: c.displayName,
      leading: <InstitutionLogo institutionId={c.institutionId} name={c.displayName} size="xs" />,
      hint: (
        <span className="inline-flex items-center gap-1">
          <CardIcon className="size-3" aria-hidden /> Cartão · disponível <Money value={c.invoiceSummary.availableLimit} />
        </span>
      ),
      keywords: ["cartão", "credito"],
    }));
  if (ghost && !ghost.active && !list.some((o) => o.value === `card-${ghost.id}`)) {
    list.unshift({ value: `card-${ghost.id}`, label: ghost.name, badge: archivedBadge(false), leading: <InstitutionLogo institutionId={ghost.institutionId} name={ghost.name} size="xs" /> });
  }
  return list;
}

/** Category or subcategory ("cat-<id>" / "sub-<id>") of one type, children indented. */
export function categoryPickerGroups(
  categories: readonly CategoryWithSubs[],
  type: "E" | "R",
  ghost?: { category?: (RefName & { color: string; icon: string }) | null; subcategory?: RefName | null },
): PickerGroup[] {
  const options: PickerOption[] = [];
  for (const c of categories.filter((x) => x.type === type)) {
    options.push({ value: `cat-${c.id}`, label: c.name, leading: <CategoryIcon icon={c.icon} color={c.color} size="xs" /> });
    for (const s of c.subcategories) {
      options.push({ value: `sub-${s.id}`, label: s.name, hint: c.name, indent: true, keywords: [c.name] });
    }
  }
  if (ghost?.subcategory && !ghost.subcategory.active) {
    options.unshift({ value: `sub-${ghost.subcategory.id}`, label: `${ghost.category?.name ?? ""} › ${ghost.subcategory.name}`, badge: archivedBadge() });
  } else if (ghost?.category && !ghost.category.active) {
    options.unshift({ value: `cat-${ghost.category.id}`, label: ghost.category.name, badge: archivedBadge(), leading: <CategoryIcon icon={ghost.category.icon} color={ghost.category.color} size="xs" /> });
  }
  return [{ options }];
}

export function parseRef(value: string | null | undefined): { kind: "acc" | "card" | "cat" | "sub"; id: Id } | null {
  if (!value) return null;
  const [kind, id] = value.split("-");
  const n = Number(id);
  if (!Number.isFinite(n)) return null;
  return { kind: kind as "acc" | "card" | "cat" | "sub", id: n };
}

/** Resolves a "cat-" / "sub-" key to category + subcategory ids. */
export function resolveCategoryKey(key: string, categories: readonly CategoryWithSubs[], ghost?: { categoryId?: Id | null; subcategoryId?: Id | null }): { categoryId: Id | null; subcategoryId: Id | null } {
  const ref = parseRef(key);
  if (!ref) return { categoryId: null, subcategoryId: null };
  if (ref.kind === "cat") return { categoryId: ref.id, subcategoryId: null };
  const cat = categories.find((c) => c.subcategories.some((s) => s.id === ref.id));
  if (cat) return { categoryId: cat.id, subcategoryId: ref.id };
  if (ghost?.subcategoryId === ref.id) return { categoryId: ghost.categoryId ?? null, subcategoryId: ref.id };
  return { categoryId: null, subcategoryId: ref.id };
}
