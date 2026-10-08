/** Home dashboard endpoints of the mock backend (§8.6). */
import { addDaysISO, monthBounds, monthKeyOf } from "@/lib/dates";
import { round2 } from "@/lib/utils";
import type { EssentialExpenses, HomeCreditCard, HomeInstitution, HomeInterval, HomeUpcomingRelease, ISODate, SpendByCategory } from "@/domain/types";
import { INSTITUTIONS } from "./institutions";
import { Ledger } from "./ledger";
import { normalize } from "@/lib/text";
import type { Dataset } from "./store";

function intervalBounds(ledger: Ledger, interval: HomeInterval): { start: ISODate; end: ISODate } {
  if (interval === "CURRENT_MONTH") return monthBounds(monthKeyOf(ledger.today));
  return { start: addDaysISO(ledger.today, -29), end: ledger.today };
}

export function revenueExpense(ds: Dataset): { revenues: number; expenses: number } {
  const ledger = new Ledger(ds);
  const { start, end } = monthBounds(monthKeyOf(ledger.today));
  let revenues = 0;
  let expenses = 0;
  for (const r of ds.releases) {
    if (r.date < start || r.date > end || !r.done || !ledger.countsInMonthTotals(r)) continue;
    if (r.type === "E") expenses += r.amount;
    else if (r.type === "R") {
      if (r.reimbursedReleaseId) expenses -= r.amount;
      else revenues += r.amount;
    }
  }
  return { revenues: round2(revenues), expenses: round2(expenses) };
}

export function accountsList(ds: Dataset): HomeInstitution[] {
  const ledger = new Ledger(ds);
  const map = new Map<string, HomeInstitution>();
  for (const a of ds.accounts) {
    if (!a.active) continue;
    const parent = a.primaryAccountId != null ? ledger.account(a.primaryAccountId) : undefined;
    if (parent && !parent.active) continue;
    const top = parent ?? a;
    if (!top.countsForOverallBalance) continue;
    const key = top.institutionId != null ? `inst-${top.institutionId}` : top.institutionName ? `other-${normalize(top.institutionName)}` : `acc-${top.id}`;
    const name = top.institutionId != null ? INSTITUTIONS.find((i) => i.id === top.institutionId)?.name ?? "Conta" : top.institutionName ?? ledger.accountDisplayName(top);
    const entry = map.get(key) ?? { key, name, institutionId: top.institutionId ?? null, balance: 0 };
    entry.balance = round2(entry.balance + ledger.balanceOf(a.id));
    map.set(key, entry);
  }
  return [...map.values()].sort((a, b) => b.balance - a.balance);
}

export function upcomingReleases(ds: Dataset): HomeUpcomingRelease[] {
  const ledger = new Ledger(ds);
  const horizon = addDaysISO(ledger.today, 30);
  return ds.releases
    .filter((r) => !r.done && r.type !== "T" && r.date <= horizon && !r.balanceAdjustment)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 40)
    .map((r) => {
      const cat = ds.categories.find((c) => c.id === r.categoryId);
      const sub = ds.subcategories.find((s) => s.id === r.subcategoryId);
      const card = ledger.card(r.creditCardId);
      const acc = ledger.account(r.accountId);
      return {
        id: r.id,
        type: r.type as "E" | "R",
        categoryColor: cat?.color ?? "#687076",
        categoryIcon: cat?.icon ?? (r.reimbursedReleaseId ? "HandCoins" : "Ellipsis"),
        categoryName: cat?.name ?? (r.reimbursedReleaseId ? "Reembolso" : "Outros"),
        subcategoryName: sub?.name ?? null,
        isCreditCardRelease: card != null,
        description: r.description ?? null,
        sourceName: card ? ledger.cardDisplayName(card) : acc ? ledger.accountLabel(acc) : "—",
        date: r.date,
        amount: r.amount,
        active: card ? card.active : acc ? acc.active : true,
      };
    });
}

function expensesIn(ds: Dataset, ledger: Ledger, start: ISODate, end: ISODate) {
  return ds.releases.filter((r) => r.type === "E" && r.date >= start && r.date <= end && ledger.countsInMonthTotals(r));
}

export function spendsByCategory(ds: Dataset, interval: HomeInterval): { spendByCategories: SpendByCategory[]; startDate: ISODate; endDate: ISODate } {
  const ledger = new Ledger(ds);
  const { start, end } = intervalBounds(ledger, interval);
  const map = new Map<number, number>();
  for (const r of expensesIn(ds, ledger, start, end)) {
    if (r.categoryId == null) continue;
    map.set(r.categoryId, (map.get(r.categoryId) ?? 0) + r.amount);
  }
  const total = [...map.values()].reduce((a, b) => a + b, 0);
  const list = [...map.entries()]
    .map(([id, value]) => {
      const c = ds.categories.find((x) => x.id === id)!;
      return { categoryId: id, categoryName: c.name, color: c.color, icon: c.icon, value: round2(value), percent: total ? round2((value / total) * 100) : 0 };
    })
    .sort((a, b) => b.value - a.value);
  return { spendByCategories: list, startDate: start, endDate: end };
}

export function essentialExpenses(ds: Dataset, interval: HomeInterval): EssentialExpenses {
  const ledger = new Ledger(ds);
  const { start, end } = intervalBounds(ledger, interval);
  let essential = 0;
  let other = 0;
  for (const r of expensesIn(ds, ledger, start, end)) {
    const sub = r.subcategoryId != null ? ds.subcategories.find((s) => s.id === r.subcategoryId) : undefined;
    const cat = ds.categories.find((c) => c.id === r.categoryId);
    const isEssential = sub ? sub.essential : Boolean(cat?.essential);
    if (isEssential) essential += r.amount;
    else other += r.amount;
  }
  const total = essential + other;
  return {
    essentialValue: round2(essential),
    notEssentialValue: round2(other),
    essentialPercent: total ? round2((essential / total) * 100) : 0,
    notEssentialPercent: total ? round2((other / total) * 100) : 0,
    startDate: start,
    endDate: end,
  };
}

export function creditCardsList(ds: Dataset): HomeCreditCard[] {
  const ledger = new Ledger(ds);
  return ds.cards.filter((c) => c.active).map((c) => {
    const card = ledger.toCard(c);
    return { cardId: c.id, cardName: card.displayName, institutionId: c.institutionId ?? null, invoiceSummary: card.invoiceSummary };
  });
}
