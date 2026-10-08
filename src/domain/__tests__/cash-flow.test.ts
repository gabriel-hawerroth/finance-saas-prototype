import { describe, expect, it } from "vitest";
import { computeMonthTotals, countActiveFilters, EMPTY_FILTERS, filterReleases, groupByDay, preselectionFromFilters, releaseTitle } from "../cash-flow";
import { release } from "./fixtures";

const acc = (id: number, name = `Conta ${id}`) => ({ id, name, active: true });
const cat = (id: number, name: string) => ({ id, name, active: true, color: "#000", icon: "Utensils", type: "E" as const });

describe("computeMonthTotals (C1)", () => {
  it("sums realized and forecast and reimbursements reduce expenses", () => {
    const totals = computeMonthTotals([
      release({ type: "R", amount: 1000, done: true }),
      release({ type: "R", amount: 500, done: false }),
      release({ type: "E", amount: 300, done: true }),
      release({ type: "E", amount: 200, done: false }),
      release({ type: "R", amount: 50, done: true, reimbursedReleaseId: 99 }),
    ]);
    expect(totals.revenues).toEqual({ done: 1000, forecast: 1500 });
    expect(totals.expenses).toEqual({ done: 250, forecast: 450 });
    expect(totals.balance).toEqual({ done: 750, forecast: 1050 });
  });

  it("ignores rows the server excluded from month totals (transfers, out of flow, invoice payments)", () => {
    const totals = computeMonthTotals([
      release({ type: "T", amount: 999, countsInMonthTotals: false }),
      release({ type: "E", amount: 80, countsInMonthTotals: false }),
      release({ kind: "INVOICE_PAYMENT", amount: 700, countsInMonthTotals: false }),
      release({ type: "E", amount: 20 }),
    ]);
    expect(totals.expenses.forecast).toBe(20);
  });

  it("avoids floating point drift", () => {
    const totals = computeMonthTotals([release({ amount: 0.1 }), release({ amount: 0.2 })]);
    expect(totals.expenses.done).toBe(0.3);
  });
});

describe("filterReleases (§4.10)", () => {
  const data = [
    release({ id: 1, account: acc(1), description: "Pão de açúcar", category: cat(10, "Alimentação") }),
    release({ id: 2, type: "T", account: acc(2), targetAccount: acc(1), description: "Reserva" }),
    release({ id: 3, card: { id: 7, name: "Nubank", active: true }, category: cat(11, "Lazer"), subcategory: { id: 50, name: "Bares", active: true } }),
    release({ id: 4, kind: "INVOICE_PAYMENT", account: acc(3), card: { id: 7, name: "Nubank", active: true }, invoiceMonthYear: "10/2026" }),
    release({ id: 5, type: "R", done: false, account: acc(3), description: "Salário" }),
  ];

  it("matches accounts on origin or destination and unions with cards without duplicates", () => {
    const ids = filterReleases(data, { ...EMPTY_FILTERS, accountIds: [1], cardIds: [7] }).map((r) => r.id);
    expect(ids).toEqual([1, 2, 3, 4]);
  });

  it("filters by whole category or specific subcategory", () => {
    expect(filterReleases(data, { ...EMPTY_FILTERS, categoryKeys: ["cat-10"] }).map((r) => r.id)).toEqual([1]);
    expect(filterReleases(data, { ...EMPTY_FILTERS, categoryKeys: ["sub-50"] }).map((r) => r.id)).toEqual([3]);
  });

  it("searches description and category ignoring case and accents", () => {
    expect(filterReleases(data, { ...EMPTY_FILTERS, description: "ACUCAR" }).map((r) => r.id)).toEqual([1]);
    expect(filterReleases(data, { ...EMPTY_FILTERS, description: "alimentacao" }).map((r) => r.id)).toEqual([1]);
    expect(filterReleases(data, { ...EMPTY_FILTERS, description: "pagamento de fatura" }).map((r) => r.id)).toEqual([4]);
  });

  it("filters by type and done", () => {
    expect(filterReleases(data, { ...EMPTY_FILTERS, type: "T" }).map((r) => r.id)).toEqual([2]);
    expect(filterReleases(data, { ...EMPTY_FILTERS, done: "NO" }).map((r) => r.id)).toEqual([5]);
  });

  it("counts active filters", () => {
    expect(countActiveFilters(EMPTY_FILTERS)).toBe(0);
    expect(countActiveFilters({ ...EMPTY_FILTERS, accountIds: [1, 2], type: "E", description: " x " })).toBe(3);
  });
});

describe("preselectionFromFilters", () => {
  it("suggests a single account or a single card, never both", () => {
    expect(preselectionFromFilters({ ...EMPTY_FILTERS, accountIds: [4] })).toEqual({ accountId: 4 });
    expect(preselectionFromFilters({ ...EMPTY_FILTERS, cardIds: [9] })).toEqual({ cardId: 9 });
    expect(preselectionFromFilters({ ...EMPTY_FILTERS, accountIds: [4], cardIds: [9] })).toEqual({});
    expect(preselectionFromFilters({ ...EMPTY_FILTERS, accountIds: [4, 5] })).toEqual({});
  });
});

describe("groupByDay / releaseTitle", () => {
  it("groups ascending by date and orders by time inside a day", () => {
    const groups = groupByDay([
      release({ id: 1, date: "2026-10-09", time: "18:00" }),
      release({ id: 2, date: "2026-10-02" }),
      release({ id: 3, date: "2026-10-09", time: "08:00" }),
    ]);
    expect(groups.map((g) => g.date)).toEqual(["2026-10-02", "2026-10-09"]);
    expect(groups[1].items.map((r) => r.id)).toEqual([3, 1]);
  });

  it("titles follow the spec precedence", () => {
    expect(releaseTitle(release({ balanceAdjustment: true, description: "x" }))).toBe("Ajuste de saldo");
    expect(releaseTitle(release({ type: "T" }))).toBe("Transferência");
    expect(releaseTitle(release({ subcategory: { id: 1, name: "Bares", active: true }, category: cat(1, "Lazer") }))).toBe("Bares");
    expect(releaseTitle(release({ kind: "INVOICE_PAYMENT", card: { id: 1, name: "Nubank", active: true } }))).toBe("Pagamento de fatura Nubank");
  });
});
