import { includesNormalized } from "@/lib/text";
import { round2 } from "@/lib/utils";
import type { Id, MonthlyRelease, ReleaseType } from "./types";

/* ───────── C1 — month totals ───────── */

export interface TotalPair {
  done: number;
  forecast: number;
}
export interface MonthTotals {
  revenues: TotalPair;
  expenses: TotalPair;
  balance: TotalPair;
}

/**
 * Month totals (spec C1): only rows the server flagged with `countsInMonthTotals`;
 * reimbursements never count as revenue — they reduce expenses. Realized sums `done`
 * rows; forecast sums all rows. Computed over the (possibly filtered) list.
 */
export function computeMonthTotals(releases: readonly MonthlyRelease[]): MonthTotals {
  let revDone = 0;
  let revAll = 0;
  let expDone = 0;
  let expAll = 0;
  for (const r of releases) {
    if (!r.countsInMonthTotals) continue;
    if (r.type === "E") {
      expAll += r.amount;
      if (r.done) expDone += r.amount;
    } else if (r.type === "R") {
      if (r.reimbursedReleaseId) {
        expAll -= r.amount;
        if (r.done) expDone -= r.amount;
      } else {
        revAll += r.amount;
        if (r.done) revDone += r.amount;
      }
    }
  }
  return {
    revenues: { done: round2(revDone), forecast: round2(revAll) },
    expenses: { done: round2(expDone), forecast: round2(expAll) },
    balance: { done: round2(revDone - expDone), forecast: round2(revAll - expAll) },
  };
}

/* ───────── Filters (§4.10) ───────── */

export type DoneFilter = "ALL" | "YES" | "NO";
export type TypeFilter = "ALL" | ReleaseType;

export interface ReleaseFilters {
  accountIds: Id[];
  cardIds: Id[];
  /** `cat-<id>` (whole category) or `sub-<id>` (specific subcategory). */
  categoryKeys: string[];
  type: TypeFilter;
  description: string;
  done: DoneFilter;
}

export const EMPTY_FILTERS: ReleaseFilters = {
  accountIds: [],
  cardIds: [],
  categoryKeys: [],
  type: "ALL",
  description: "",
  done: "ALL",
};

export function countActiveFilters(f: ReleaseFilters): number {
  return (
    (f.accountIds.length ? 1 : 0) +
    (f.cardIds.length ? 1 : 0) +
    (f.categoryKeys.length ? 1 : 0) +
    (f.type !== "ALL" ? 1 : 0) +
    (f.description.trim() ? 1 : 0) +
    (f.done !== "ALL" ? 1 : 0)
  );
}

export function releaseTitle(r: MonthlyRelease): string {
  if (r.kind === "INVOICE_PAYMENT") return `Pagamento de fatura ${r.card?.name ?? ""}`.trim();
  if (r.balanceAdjustment) return "Ajuste de saldo";
  if (r.type === "T") return r.description || "Transferência";
  return r.description || r.subcategory?.name || r.category?.name || (r.reimbursedReleaseId ? "Reembolso" : "Outros");
}

function matchesSource(r: MonthlyRelease, f: ReleaseFilters): boolean {
  const hasAcc = f.accountIds.length > 0;
  const hasCard = f.cardIds.length > 0;
  if (!hasAcc && !hasCard) return true;
  const byAccount =
    hasAcc &&
    ((r.account && f.accountIds.includes(r.account.id)) ||
      (r.targetAccount && f.accountIds.includes(r.targetAccount.id)));
  const byCard = hasCard && r.card != null && f.cardIds.includes(r.card.id);
  // Union of both sets; an invoice payment (account + card) is a single row so it never duplicates.
  return Boolean(byAccount || byCard);
}

function matchesCategory(r: MonthlyRelease, keys: string[]): boolean {
  if (keys.length === 0) return true;
  if (r.category && keys.includes(`cat-${r.category.id}`)) return true;
  if (r.subcategory && keys.includes(`sub-${r.subcategory.id}`)) return true;
  return false;
}

export function filterReleases(releases: readonly MonthlyRelease[], f: ReleaseFilters): MonthlyRelease[] {
  const text = f.description.trim();
  return releases.filter((r) => {
    if (!matchesSource(r, f)) return false;
    if (!matchesCategory(r, f.categoryKeys)) return false;
    if (f.type !== "ALL" && r.type !== f.type) return false;
    if (f.done === "YES" && !r.done) return false;
    if (f.done === "NO" && r.done) return false;
    if (text) {
      const haystacks =
        r.kind === "INVOICE_PAYMENT"
          ? [releaseTitle(r), r.invoiceMonthYear ?? ""]
          : [r.description ?? "", r.category?.name ?? "", r.subcategory?.name ?? ""];
      if (!haystacks.some((h) => includesNormalized(h, text))) return false;
    }
    return true;
  });
}

/** Source preselection for "new release" from the active filters (§4.10). */
export function preselectionFromFilters(f: ReleaseFilters): { accountId?: Id; cardId?: Id } {
  if (f.accountIds.length === 1 && f.cardIds.length === 0) return { accountId: f.accountIds[0] };
  if (f.cardIds.length === 1 && f.accountIds.length === 0) return { cardId: f.cardIds[0] };
  return {};
}

export interface DayGroup {
  date: string;
  items: MonthlyRelease[];
  net: number;
}

/** Groups by day in ascending order; inside a day, by time then id. */
export function groupByDay(releases: readonly MonthlyRelease[]): DayGroup[] {
  const map = new Map<string, MonthlyRelease[]>();
  for (const r of releases) {
    const list = map.get(r.date) ?? [];
    list.push(r);
    map.set(r.date, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, items]) => ({
      date,
      items: items.sort((a, b) => (a.time ?? "").localeCompare(b.time ?? "") || a.id - b.id),
      net: round2(
        items.reduce((acc, r) => {
          if (!r.countsInMonthTotals) return acc;
          if (r.type === "E") return acc - r.amount;
          if (r.type === "R") return acc + r.amount;
          return acc;
        }, 0),
      ),
    }));
}

/** Signed amount for display: − expense / invoice payment, + revenue and transfer (§4.10). */
export function signedAmount(r: MonthlyRelease): number {
  return r.type === "E" || r.kind === "INVOICE_PAYMENT" ? -r.amount : r.amount;
}
