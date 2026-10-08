/**
 * Credit-card cycle engine of the mock backend. Everything here is "server decides"
 * in the spec (§7.1): cycle boundaries, invoice of each release, amounts, outstanding,
 * settlement, card summary and available limit.
 *
 * A cycle is identified by `key` = month of its natural close date (yyyy-MM). Its
 * actual close/due dates may be overridden by a materialised invoice row (manual
 * correction or frozen history after a cycle change).
 */
import { addDaysISO, daysInMonth, monthKeyOf, parseDate, shiftMonthKey, toISODate } from "@/lib/dates";
import { round2 } from "@/lib/utils";
import type { CardInvoiceSummary, ISODate, InvoiceStatus } from "@/domain/types";
import { nextId, type Dataset, type StoredCard, type StoredInvoice, type StoredPayment, type StoredRelease } from "./store";

export interface Cycle {
  key: string;
  row?: StoredInvoice;
  firstDay: ISODate;
  closeDate: ISODate;
  dueDate: ISODate;
  status: InvoiceStatus;
  referenceMonth: string;
  sharesReferenceMonth: boolean;
  releases: StoredRelease[];
  payments: StoredPayment[];
  purchases: number;
  installments: number;
  previousBalance: number;
  amount: number;
  paid: number;
  outstanding: number;
  settled: boolean;
  settledByDueDate: ISODate | null;
  /** Sum of every release of the cycle (done + pending). */
  grossAll: number;
}

function dateIn(key: string, day: number): ISODate {
  const [y, m] = key.split("-").map(Number);
  const d = Math.min(day, daysInMonth(y, m - 1));
  return toISODate(new Date(y, m - 1, d, 12));
}

export function naturalClose(card: Pick<StoredCard, "closeDay">, key: string): ISODate {
  return dateIn(key, card.closeDay);
}

export function naturalDue(card: Pick<StoredCard, "closeDay" | "invoiceDueDay">, key: string): ISODate {
  return card.invoiceDueDay > card.closeDay ? dateIn(key, card.invoiceDueDay) : dateIn(shiftMonthKey(key, 1), card.invoiceDueDay);
}

function cardRange(ds: Dataset, card: StoredCard, today: ISODate): { start: string; end: string } {
  let start = shiftMonthKey(monthKeyOf(card.createdAt.slice(0, 10)), -1);
  let end = shiftMonthKey(monthKeyOf(today), 12);
  for (const r of ds.releases) {
    if (r.creditCardId !== card.id) continue;
    const k = monthKeyOf(r.date);
    if (k < start) start = shiftMonthKey(k, -1);
    if (k >= end) end = shiftMonthKey(k, 1);
    if (r.pinnedInvoiceKey) {
      if (r.pinnedInvoiceKey < start) start = r.pinnedInvoiceKey;
      if (r.pinnedInvoiceKey > end) end = r.pinnedInvoiceKey;
    }
  }
  for (const inv of ds.invoices) {
    if (inv.creditCardId !== card.id) continue;
    if (inv.key < start) start = inv.key;
    if (inv.key > end) end = inv.key;
  }
  return { start, end };
}

function statusOf(firstDay: ISODate, closeDate: ISODate, today: ISODate): InvoiceStatus {
  if (today > closeDate) return "CLOSED";
  if (today >= firstDay) return "OPEN";
  return "FUTURE";
}

/** Builds every cycle of a card with its releases, payments and computed values. */
export function buildCycles(ds: Dataset, card: StoredCard, today: ISODate): Cycle[] {
  const { start, end } = cardRange(ds, card, today);
  const rows = new Map(ds.invoices.filter((i) => i.creditCardId === card.id).map((i) => [i.key, i]));
  const cycles: Cycle[] = [];
  let prevClose = (() => {
    const prevKey = shiftMonthKey(start, -1);
    return rows.get(prevKey)?.closeDate ?? naturalClose(card, prevKey);
  })();

  for (let key = start; key <= end; key = shiftMonthKey(key, 1)) {
    const row = rows.get(key);
    const closeDate = row?.closeDate ?? naturalClose(card, key);
    const dueDate = row?.dueDate ?? naturalDue(card, key);
    const firstDay = addDaysISO(prevClose, 1);
    const due = parseDate(dueDate);
    cycles.push({
      key,
      row,
      firstDay,
      closeDate,
      dueDate,
      status: statusOf(firstDay, closeDate, today),
      referenceMonth: `${String(due.getMonth() + 1).padStart(2, "0")}/${due.getFullYear()}`,
      sharesReferenceMonth: false,
      releases: [],
      payments: [],
      purchases: 0,
      installments: 0,
      previousBalance: 0,
      amount: 0,
      paid: 0,
      outstanding: 0,
      settled: false,
      settledByDueDate: null,
      grossAll: 0,
    });
    prevClose = closeDate;
  }

  const refCount = new Map<string, number>();
  for (const c of cycles) refCount.set(c.referenceMonth, (refCount.get(c.referenceMonth) ?? 0) + 1);
  for (const c of cycles) c.sharesReferenceMonth = (refCount.get(c.referenceMonth) ?? 0) > 1;

  const byKey = new Map(cycles.map((c) => [c.key, c]));
  for (const r of ds.releases) {
    if (r.creditCardId !== card.id) continue;
    const target = r.pinnedInvoiceKey ? byKey.get(r.pinnedInvoiceKey) : cycles.find((c) => r.date >= c.firstDay && r.date <= c.closeDate);
    if (target) target.releases.push(r);
  }
  const rowById = new Map(ds.invoices.filter((i) => i.creditCardId === card.id).map((i) => [i.id, i]));
  for (const p of ds.payments) {
    if (p.creditCardId !== card.id) continue;
    const row = rowById.get(p.invoiceId);
    const target = row ? byKey.get(row.key) : undefined;
    if (target) target.payments.push(p);
  }

  let carry = 0;
  for (let i = 0; i < cycles.length; i++) {
    const c = cycles[i];
    for (const r of c.releases) {
      c.grossAll += r.amount;
      if (!r.done) continue;
      if (r.installmentNumber) c.installments += r.amount;
      else c.purchases += r.amount;
    }
    c.purchases = round2(c.purchases);
    c.installments = round2(c.installments);
    c.grossAll = round2(c.grossAll);
    c.previousBalance = round2(carry);
    c.amount = round2(c.previousBalance + c.purchases + c.installments);
    c.paid = round2(c.payments.reduce((s, p) => s + p.amount, 0));
    // Unpaid balance (or credit) rolls into the next invoice once this one is past due.
    carry = c.status === "CLOSED" && c.dueDate < today ? c.amount - c.paid : 0;
  }

  for (let i = 0; i < cycles.length; i++) {
    const c = cycles[i];
    const remaining = round2(c.amount - c.paid);
    let laterPaid = 0;
    let settledBy: ISODate | null = null;
    for (let j = i + 1; j < cycles.length; j++) {
      if (cycles[j].paid <= 0) continue;
      laterPaid += cycles[j].paid;
      if (!settledBy && remaining > 0 && laterPaid >= remaining - 0.004) settledBy = cycles[j].dueDate;
    }
    c.outstanding = round2(Math.max(0, remaining - laterPaid));
    c.settled = c.amount > 0.004 && c.outstanding < 0.005;
    c.settledByDueDate = c.settled && remaining > 0.004 ? settledBy : null;
  }
  return cycles;
}

/** Ensures every non-future cycle has a materialised row (and therefore an invoice id). */
export function ensureRows(ds: Dataset, card: StoredCard, today: ISODate): void {
  const cycles = buildCycles(ds, card, today);
  for (const c of cycles) {
    if (c.status !== "FUTURE" && !c.row) {
      ds.invoices.push({ id: nextId(ds), creditCardId: card.id, key: c.key, closeDayPinned: false, dueDatePinned: false });
    }
  }
}

export function materialize(ds: Dataset, card: StoredCard, key: string): StoredInvoice {
  const existing = ds.invoices.find((i) => i.creditCardId === card.id && i.key === key);
  if (existing) return existing;
  const row: StoredInvoice = { id: nextId(ds), creditCardId: card.id, key, closeDayPinned: false, dueDatePinned: false };
  ds.invoices.push(row);
  return row;
}

export function findCycleByClose(cycles: readonly Cycle[], closeDate: ISODate): Cycle | undefined {
  return cycles.find((c) => c.closeDate === closeDate) ?? cycles.find((c) => closeDate >= c.firstDay && closeDate <= c.closeDate);
}

export function openCycle(cycles: readonly Cycle[]): Cycle | undefined {
  return cycles.find((c) => c.status === "OPEN") ?? cycles.find((c) => c.status === "FUTURE");
}

/** The invoice that "asks for action" and the open-cycle numbers (CardInvoiceSummary). */
export function cardSummary(card: StoredCard, cycles: readonly Cycle[]): CardInvoiceSummary {
  const open = openCycle(cycles);
  const closed = cycles.filter((c) => c.status === "CLOSED");
  const lastClosed = closed[closed.length - 1];
  const current = open ?? cycles[cycles.length - 1];

  const notClosed = cycles.filter((c) => c.status !== "CLOSED");
  const used =
    (lastClosed ? lastClosed.outstanding : 0) +
    notClosed.reduce((s, c) => s + c.grossAll, 0) -
    notClosed.reduce((s, c) => s + c.paid, 0);
  const availableLimit = round2(card.cardLimit - Math.max(0, used));

  const base = {
    currentInvoiceAmount: current ? round2(current.purchases + current.installments + current.previousBalance) : 0,
    availableLimit,
  };
  if (lastClosed && lastClosed.outstanding > 0.004) {
    return { state: "CLOSED", referenceMonth: lastClosed.referenceMonth, closeDate: lastClosed.closeDate, dueDate: lastClosed.dueDate, amount: lastClosed.amount, outstanding: lastClosed.outstanding, ...base };
  }
  const today = toISODate(new Date());
  if (lastClosed && lastClosed.settled && lastClosed.dueDate >= today) {
    return { state: "PAID", referenceMonth: lastClosed.referenceMonth, closeDate: lastClosed.closeDate, dueDate: lastClosed.dueDate, amount: lastClosed.amount, outstanding: 0, ...base };
  }
  return {
    state: "OPEN",
    referenceMonth: current?.referenceMonth ?? "",
    closeDate: current?.closeDate ?? today,
    dueDate: current?.dueDate ?? today,
    amount: current?.amount ?? 0,
    outstanding: current?.outstanding ?? 0,
    ...base,
  };
}
