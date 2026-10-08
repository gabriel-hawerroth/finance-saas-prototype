import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/domain/errors";
import { computeMonthTotals } from "@/domain/cash-flow";
import type { PaidInvoiceConflictDetails } from "@/domain/types";
import { activateAccount, adjustBalance, createAccount, deleteAccount, inactivateAccount, listAccounts, overallBalance } from "../accounts";
import { addPayment, cycleValues, invoicesByCard, simulateCycleChange } from "../cards";
import { moveReleases } from "../categories";
import { buildCycles } from "../invoice-engine";
import { Ledger } from "../ledger";
import { createRelease, deleteRelease, getMonthlyReleases, updateDone, updateRelease } from "../releases";
import { buildDemoDataset, buildStarterDataset } from "../seed";
import type { Dataset } from "../store";

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-08T15:00:00"));
});
afterAll(() => vi.useRealTimers());

const catId = (ds: Dataset, name: string) => ds.categories.find((c) => c.name === name)!.id;

function expectApiError(fn: () => unknown, code?: string, status?: number): ApiError {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(ApiError);
    const err = e as ApiError;
    if (code) expect(err.code).toBe(code);
    if (status) expect(err.status).toBe(status);
    return err;
  }
  throw new Error("expected ApiError");
}

/** Minimal dataset: one checking account and one card closing on day 10, due on day 17. */
function smallDataset() {
  const ds = buildStarterDataset();
  const acc = createAccount(ds, { name: "Corrente", type: "CHECKING", institutionId: 2, balance: 5000, countsForOverallBalance: true, visibleInCashFlow: true });
  ds.cards.push({ id: 9000, name: "Cartão", cardLimit: 3000, closeDay: 10, invoiceDueDay: 17, institutionId: 2, standardPaymentAccountId: acc.id, active: true, createdAt: "2026-06-01T10:00:00.000Z" });
  return { ds, acc, cardId: 9000 };
}

describe("demo dataset", () => {
  const ds = buildDemoDataset();

  it("is coherent: overall balance = available + saved + investments", () => {
    const o = overallBalance(ds);
    expect(o.overallBalance).toBeCloseTo(o.availableBalance + o.savedBalance + o.investmentsBalance, 2);
    expect(o.totalBalance).toBeGreaterThanOrEqual(o.overallBalance);
  });

  it("has every past-due card invoice paid", () => {
    const ledger = new Ledger(ds);
    for (const card of ds.cards) {
      for (const c of ledger.cyclesOf(card)) {
        if (c.status === "CLOSED" && c.dueDate < "2026-10-08" && c.amount > 0) expect(c.outstanding).toBe(0);
      }
    }
  });

  it("projects the current month with invoice payments as read-only rows", () => {
    const rows = getMonthlyReleases(ds, "2026-10");
    expect(rows.some((r) => r.kind === "INVOICE_PAYMENT" && !r.countsInMonthTotals)).toBe(true);
    const totals = computeMonthTotals(rows);
    expect(totals.revenues.forecast).toBeGreaterThan(0);
  });
});

describe("releases", () => {
  it("creates installment series with monthly dates and the purchase date on each", () => {
    const { ds, acc } = smallDataset();
    createRelease(ds, { type: "E", amount: 100, accountId: acc.id, categoryId: catId(ds, "Compras"), date: "2026-10-08", done: true, countsInCashFlow: true, repeat: "INSTALLMENTS" }, 3);
    const series = ds.releases.filter((r) => r.repeat === "INSTALLMENTS");
    expect(series.map((r) => r.date)).toEqual(["2026-10-08", "2026-11-08", "2026-12-08"]);
    expect(new Set(series.map((r) => r.seriesId)).size).toBe(1);
    expect(series.every((r) => r.purchaseDate === "2026-10-08")).toBe(true);
    expect(series.map((r) => r.installmentNumber)).toEqual([1, 2, 3]);
  });

  it("edits only this / next / all occurrences of a fixed series and refuses a date change for many", () => {
    const { ds, acc } = smallDataset();
    createRelease(ds, { type: "E", amount: 50, accountId: acc.id, categoryId: catId(ds, "Moradia"), date: "2026-10-01", done: false, countsInCashFlow: true, repeat: "FIXED", fixedBy: "MONTHLY" }, 4);
    const [, second] = ds.releases.filter((r) => r.repeat === "FIXED");
    const dto = { type: "E" as const, amount: 80, accountId: acc.id, categoryId: catId(ds, "Moradia"), date: second.date, done: false, countsInCashFlow: true };
    updateRelease(ds, second.id, dto, "NEXTS");
    expect(ds.releases.filter((r) => r.repeat === "FIXED").map((r) => r.amount)).toEqual([50, 80, 80, 80]);
    expectApiError(() => updateRelease(ds, second.id, { ...dto, date: "2026-11-15" }, "ALL"), undefined, 400);
  });

  it("enforces reimbursement rules", () => {
    const { ds, acc } = smallDataset();
    const { id } = createRelease(ds, { type: "E", amount: 100, accountId: acc.id, categoryId: catId(ds, "Lazer"), date: "2026-10-05", done: false, countsInCashFlow: true }, 0);
    const reimb = { type: "R" as const, amount: 40, accountId: acc.id, date: "2026-10-06", done: true, countsInCashFlow: true, reimbursedReleaseId: id };
    expectApiError(() => createRelease(ds, reimb, 0), "REIMBURSED_EXPENSE_NOT_DONE");
    updateDone(ds, id, true);
    createRelease(ds, reimb, 0);
    expectApiError(() => createRelease(ds, { ...reimb, amount: 70 }, 0), "REIMBURSEMENT_EXCEEDS_EXPENSE");
    expectApiError(() => updateDone(ds, id, false), "REIMBURSED_EXPENSE_MUST_STAY_DONE");
    expectApiError(() => deleteRelease(ds, id, "UNNECESSARY"), "EXPENSE_HAS_REIMBURSEMENTS");
    const rows = getMonthlyReleases(ds, "2026-10");
    const expense = rows.find((r) => r.id === id)!;
    expect(expense.reimbursedAmount).toBe(40);
    expect(expense.netAmount).toBe(60);
    expect(computeMonthTotals(rows).expenses.done).toBe(60);
  });
});

describe("credit card invoices", () => {
  it("assigns purchases by cycle, carries unpaid balances and settles by later payments", () => {
    const { ds, cardId, acc } = smallDataset();
    const cat = catId(ds, "Compras");
    createRelease(ds, { type: "E", amount: 200, creditCardId: cardId, categoryId: cat, date: "2026-08-15", done: true, countsInCashFlow: true }, 0);
    createRelease(ds, { type: "E", amount: 100, creditCardId: cardId, categoryId: cat, date: "2026-09-12", done: true, countsInCashFlow: true }, 0);
    const card = ds.cards[0];
    let cycles = buildCycles(ds, card, "2026-10-08");
    const sep = cycles.find((c) => c.closeDate === "2026-09-10")!;
    const oct = cycles.find((c) => c.closeDate === "2026-10-10")!;
    expect(sep.amount).toBe(200);
    expect(sep.status).toBe("CLOSED");
    expect(oct.status).toBe("OPEN");
    // September is past due and unpaid → it rolls into October.
    expect(oct.previousBalance).toBe(200);
    expect(oct.amount).toBe(300);
    invoicesByCard(ds, cardId);
    addPayment(ds, { creditCardId: cardId, closeDate: "2026-10-10", paymentAccountId: acc.id, paymentAmount: 300, paymentDate: "2026-10-08" });
    cycles = buildCycles(ds, card, "2026-10-08");
    const sepAfter = cycles.find((c) => c.closeDate === "2026-09-10")!;
    expect(sepAfter.settled).toBe(true);
    expect(sepAfter.settledByDueDate).toBe("2026-10-17");
    expect(cycleValues(ds, cardId, "2026-10-10").outstanding).toBe(0);
  });

  it("refuses payments above the invoice amount or in the future", () => {
    const { ds, cardId, acc } = smallDataset();
    createRelease(ds, { type: "E", amount: 100, creditCardId: cardId, categoryId: catId(ds, "Compras"), date: "2026-10-01", done: true, countsInCashFlow: true }, 0);
    expectApiError(() => addPayment(ds, { creditCardId: cardId, closeDate: "2026-10-10", paymentAccountId: acc.id, paymentAmount: 150, paymentDate: "2026-10-08" }), undefined, 400);
    expectApiError(() => addPayment(ds, { creditCardId: cardId, closeDate: "2026-10-10", paymentAccountId: acc.id, paymentAmount: 50, paymentDate: "2026-10-09" }), undefined, 400);
  });

  it("raises PAID_INVOICE when a change reaches a paid invoice and can move the release to the open one", () => {
    const { ds, cardId, acc } = smallDataset();
    const cat = catId(ds, "Compras");
    createRelease(ds, { type: "E", amount: 100, creditCardId: cardId, categoryId: cat, date: "2026-09-05", done: true, countsInCashFlow: true }, 0);
    invoicesByCard(ds, cardId);
    addPayment(ds, { creditCardId: cardId, closeDate: "2026-09-10", paymentAccountId: acc.id, paymentAmount: 100, paymentDate: "2026-09-15" });

    const dto = { type: "E" as const, amount: 40, creditCardId: cardId, categoryId: cat, date: "2026-09-06", done: true, countsInCashFlow: true };
    const err = expectApiError(() => createRelease(structuredClone(ds), dto, 0), "PAID_INVOICE", 422);
    const details = err.details as PaidInvoiceConflictDetails;
    expect(details.canMove).toBe(true);
    expect(details.invoices[0].outstandingAfter).toBe(40);

    createRelease(ds, dto, 0, "MOVE_TO_OPEN");
    const moved = ds.releases.find((r) => r.amount === 40)!;
    expect(moved.pinnedInvoiceKey).toBe("2026-10");
    expect(moved.date).toBe("2026-09-06");
    expect(cycleValues(ds, cardId, "2026-09-10").settled).toBe(true);
  });

  it("simulates a cycle change and reports releases changing invoice", () => {
    const { ds, cardId } = smallDataset();
    createRelease(ds, { type: "E", amount: 10, creditCardId: cardId, categoryId: catId(ds, "Compras"), date: "2026-10-20", done: true, countsInCashFlow: true }, 0);
    const sim = simulateCycleChange(ds, cardId, 25, 2);
    expect(sim.invoices.length).toBeGreaterThan(0);
    expect(sim.invoices[0].transition).toBe(true);
    expect(sim.releasesChangingInvoice).toBe(1);
  });
});

describe("accounts and piggy banks", () => {
  it("moves the initial amount into a new piggy bank and returns it on archive", () => {
    const { ds, acc } = smallDataset();
    const piggy = createAccount(ds, { name: "Reserva", primaryAccountId: acc.id, purpose: "SAVINGS", initialAmount: 1200, countsForOverallBalance: true, visibleInCashFlow: true });
    let accounts = listAccounts(ds);
    expect(accounts.find((a) => a.id === piggy.id)!.balance).toBe(1200);
    expect(accounts.find((a) => a.id === acc.id)!.balance).toBe(3800);
    expect(overallBalance(ds).savedBalance).toBe(1200);
    expect(overallBalance(ds).overallBalance).toBe(5000);
    inactivateAccount(ds, piggy.id);
    accounts = listAccounts(ds);
    expect(accounts.find((a) => a.id === acc.id)!.balance).toBe(5000);
    expect(accounts.find((a) => a.id === piggy.id)!.active).toBe(false);
    activateAccount(ds, piggy.id, []);
    expect(listAccounts(ds).find((a) => a.id === piggy.id)!.active).toBe(true);
  });

  it("refuses to archive a piggy bank with negative balance", () => {
    const { ds, acc } = smallDataset();
    const piggy = createAccount(ds, { name: "Viagem", primaryAccountId: acc.id, countsForOverallBalance: true, visibleInCashFlow: true });
    adjustBalance(ds, piggy.id, -10);
    expectApiError(() => inactivateAccount(ds, piggy.id), "PIGGY_BANK_NEGATIVE_BALANCE");
  });

  it("corrects balances with an adjustment that stays out of month totals", () => {
    const { ds, acc } = smallDataset();
    adjustBalance(ds, acc.id, 4200.5);
    expect(listAccounts(ds).find((a) => a.id === acc.id)!.balance).toBe(4200.5);
    const rows = getMonthlyReleases(ds, "2026-10");
    expect(rows.find((r) => r.balanceAdjustment)?.countsInMonthTotals).toBe(false);
  });

  it("only deletes accounts without linked records", () => {
    const { ds, acc } = smallDataset();
    expectApiError(() => deleteAccount(ds, acc.id), "LINKED_REGISTERS");
    const free = createAccount(ds, { name: "Vazia", type: "CASH", institutionId: 1, balance: 0, countsForOverallBalance: true, visibleInCashFlow: true });
    deleteAccount(ds, free.id);
    expect(ds.accounts.some((a) => a.id === free.id)).toBe(false);
  });
});

describe("categories", () => {
  it("moves releases between categories of the same type only", () => {
    const { ds, acc } = smallDataset();
    const lazer = catId(ds, "Lazer");
    createRelease(ds, { type: "E", amount: 5, accountId: acc.id, categoryId: lazer, date: "2026-10-01", done: true, countsInCashFlow: true }, 0);
    createRelease(ds, { type: "E", amount: 6, accountId: acc.id, categoryId: lazer, date: "2026-10-02", done: true, countsInCashFlow: true }, 0);
    expectApiError(() => moveReleases(ds, { sourceCategoryId: lazer, targetCategoryId: catId(ds, "Salário") }), undefined, 400);
    expect(moveReleases(ds, { sourceCategoryId: lazer, targetCategoryId: catId(ds, "Compras") })).toBe(2);
  });
});
