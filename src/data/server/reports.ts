/** Report endpoints of the mock backend (§8.6). Percentages are decided here. */
import { addDaysISO, addMonthsISO, monthBounds, monthKeyOf, parseDate, toISODate } from "@/lib/dates";
import { round2 } from "@/lib/utils";
import { startOfWeek } from "date-fns";
import type {
  BalanceEvolutionPoint,
  BalanceGrouper,
  Id,
  ISODate,
  ReleasesByAccountItem,
  ReleasesByCategoryItem,
  ReleasesBySubcategoryItem,
  ReportPeriod,
} from "@/domain/types";
import { Ledger } from "./ledger";
import type { Dataset, StoredRelease } from "./store";

export function resolvePeriod(period: ReportPeriod, today: ISODate): { start: ISODate; end: ISODate } {
  switch (period.interval) {
    case "LAST_30_DAYS":
      return { start: addDaysISO(today, -29), end: today };
    case "LAST_12_MONTHS":
      return { start: monthBounds(monthKeyOf(addMonthsISO(today, -11))).start, end: monthBounds(monthKeyOf(today)).end };
    default:
      return { start: period.initialDate ?? monthBounds(monthKeyOf(today)).start, end: period.finalDate ?? monthBounds(monthKeyOf(today)).end };
  }
}

function releasesIn(ds: Dataset, ledger: Ledger, period: ReportPeriod): StoredRelease[] {
  const { start, end } = resolvePeriod(period, ledger.today);
  return ds.releases.filter((r) => r.date >= start && r.date <= end && ledger.countsInMonthTotals(r) && !r.reimbursedReleaseId);
}

function withPercent<T extends { value: number }>(items: T[]): (T & { percent: number })[] {
  const total = items.reduce((s, i) => s + i.value, 0);
  return items
    .map((i) => ({ ...i, value: round2(i.value), percent: total ? round2((i.value / total) * 100) : 0 }))
    .sort((a, b) => b.value - a.value);
}

export function byCategory(ds: Dataset, period: ReportPeriod): { expenses: ReleasesByCategoryItem[]; revenues: ReleasesByCategoryItem[] } {
  const ledger = new Ledger(ds);
  const list = releasesIn(ds, ledger, period);
  const build = (type: "E" | "R") => {
    const map = new Map<Id, number>();
    for (const r of list) if (r.type === type && r.categoryId != null) map.set(r.categoryId, (map.get(r.categoryId) ?? 0) + r.amount);
    return withPercent(
      [...map.entries()].map(([id, value]) => {
        const c = ds.categories.find((x) => x.id === id)!;
        return { category: { id, name: c.name, color: c.color, icon: c.icon }, value };
      }),
    );
  };
  return { expenses: build("E"), revenues: build("R") };
}

export function bySubcategory(ds: Dataset, categoryId: Id, period: ReportPeriod): ReleasesBySubcategoryItem[] {
  const ledger = new Ledger(ds);
  const map = new Map<string, number>();
  for (const r of releasesIn(ds, ledger, period)) {
    if (r.categoryId !== categoryId) continue;
    const name = r.subcategoryId != null ? ds.subcategories.find((s) => s.id === r.subcategoryId)?.name ?? "principal" : "principal";
    map.set(name, (map.get(name) ?? 0) + r.amount);
  }
  return withPercent([...map.entries()].map(([subcategoryName, value]) => ({ subcategoryName, value })));
}

export function byAccount(ds: Dataset, period: ReportPeriod): { expenses: ReleasesByAccountItem[]; revenues: ReleasesByAccountItem[] } {
  const ledger = new Ledger(ds);
  const list = releasesIn(ds, ledger, period);
  const build = (type: "E" | "R") => {
    const map = new Map<string, number>();
    for (const r of list) {
      if (r.type !== type) continue;
      const card = ledger.card(r.creditCardId);
      const acc = ledger.account(r.accountId);
      const name = card ? ledger.cardDisplayName(card) : acc ? ledger.accountLabel(acc) : "—";
      map.set(name, (map.get(name) ?? 0) + r.amount);
    }
    return withPercent([...map.entries()].map(([accountName, value]) => ({ accountName, value })));
  };
  return { expenses: build("E"), revenues: build("R") };
}

/** Balance over time for one account (or all active ones), grouped by day/week/month or per release. */
export function balanceEvolution(ds: Dataset, period: ReportPeriod, grouper: BalanceGrouper, accountId?: Id | null): BalanceEvolutionPoint[] {
  const ledger = new Ledger(ds);
  const { start, end: periodEnd } = resolvePeriod(period, ledger.today);
  // Balances only exist up to today; future dates would just repeat the last value.
  const end = periodEnd > ledger.today ? ledger.today : periodEnd;
  if (start > end) return [];
  const accountIds = new Set(accountId != null ? [accountId] : ds.accounts.filter((a) => a.active).map((a) => a.id));
  const effect = (r: StoredRelease): number => {
    if (!r.done || r.creditCardId != null) return 0;
    let v = 0;
    if (r.type === "R" && accountIds.has(r.accountId!)) v += r.amount;
    if (r.type === "E" && accountIds.has(r.accountId!)) v -= r.amount;
    if (r.type === "T") {
      if (accountIds.has(r.accountId!)) v -= r.amount;
      if (r.targetAccountId != null && accountIds.has(r.targetAccountId)) v += r.amount;
    }
    return v;
  };
  const events: { date: ISODate; delta: number }[] = [
    ...ds.releases.map((r) => ({ date: r.date, delta: effect(r) })),
    ...ds.payments.filter((p) => accountIds.has(p.accountId)).map((p) => ({ date: p.date, delta: -p.amount })),
  ].filter((e) => e.delta !== 0);
  events.sort((a, b) => a.date.localeCompare(b.date));

  let balance = ds.accounts.filter((a) => accountIds.has(a.id)).reduce((s, a) => s + a.initialBalance, 0);
  let i = 0;
  while (i < events.length && events[i].date < start) balance += events[i++].delta;

  const points: BalanceEvolutionPoint[] = [];
  if (grouper === "BY_RELEASE") {
    points.push({ date: start, amount: round2(balance) });
    for (; i < events.length && events[i].date <= end; i++) {
      balance += events[i].delta;
      points.push({ date: events[i].date, amount: round2(balance) });
    }
    return points;
  }
  const bucketOf = (d: ISODate): ISODate =>
    grouper === "DAILY" ? d : grouper === "WEEKLY" ? toISODate(startOfWeek(parseDate(d), { weekStartsOn: 1 })) : `${d.slice(0, 7)}-01`;
  let cursor = start;
  let lastBucket = "";
  while (cursor <= end) {
    while (i < events.length && events[i].date <= cursor) balance += events[i++].delta;
    const bucket = bucketOf(cursor);
    if (bucket !== lastBucket) {
      points.push({ date: cursor, amount: round2(balance) });
      lastBucket = bucket;
    } else {
      points[points.length - 1] = { date: points[points.length - 1].date, amount: round2(balance) };
    }
    cursor = addDaysISO(cursor, 1);
  }
  return points;
}
