/** Credit card and invoice endpoints of the mock backend (§8.4). */
import { ApiError } from "@/domain/errors";
import { cycleDays, isAtypicalCycle } from "@/domain/card-cycle";
import { invoiceLabel } from "@/lib/format";
import { addDaysISO, daysBetween, shiftMonthKey } from "@/lib/dates";
import { round2 } from "@/lib/utils";
import type {
  Attachment,
  CreditCard,
  Id,
  ISODate,
  InvoiceCycleChange,
  InvoiceCycleValues,
  InvoiceHasPaymentDetails,
  InvoiceOption,
  InvoicePayment,
  SaveCardDTO,
  SaveInvoicePaymentDTO,
} from "@/domain/types";
import { buildCycles, ensureRows, findCycleByClose, materialize, naturalClose, naturalDue, type Cycle } from "./invoice-engine";
import { INSTITUTIONS, WALLET_ID } from "./institutions";
import { Ledger } from "./ledger";
import { nextId, nowISO, type Dataset, type StoredCard, type StoredPayment } from "./store";

const bad = (d: string) => new ApiError(400, { errorDescription: d });

function findCard(ds: Dataset, id: Id): StoredCard {
  const c = ds.cards.find((x) => x.id === id);
  if (!c) throw new ApiError(404, { errorDescription: "card not found" });
  return c;
}

function validateCard(ds: Dataset, dto: SaveCardDTO): void {
  if (!dto.name?.trim() && dto.institutionId == null) throw bad("name or institution required");
  if (dto.institutionId != null) {
    const inst = INSTITUTIONS.find((i) => i.id === dto.institutionId);
    if (!inst || inst.id === WALLET_ID) throw bad("invalid institution");
  }
  if (!(dto.cardLimit > 0)) throw bad("limit must be greater than zero");
  for (const d of [dto.closeDay, dto.invoiceDueDay]) if (!(d >= 1 && d <= 31)) throw bad("invalid day");
  const acc = ds.accounts.find((a) => a.id === dto.standardPaymentAccountId);
  if (!acc || acc.primaryAccountId != null) throw bad("invalid payment account");
}

/* ───── cards ───── */

export function listCards(ds: Dataset): CreditCard[] {
  const ledger = new Ledger(ds);
  return [...ds.cards].sort((a, b) => Number(b.active) - Number(a.active) || ledger.cardDisplayName(a).localeCompare(ledger.cardDisplayName(b), "pt-BR")).map((c) => ledger.toCard(c));
}

export function getCard(ds: Dataset, id: Id): CreditCard {
  return new Ledger(ds).toCard(findCard(ds, id));
}

export function cardsByInstitution(ds: Dataset): { institutionId: Id | null; cards: CreditCard[] }[] {
  const cards = listCards(ds).filter((c) => c.active);
  const map = new Map<Id | null, CreditCard[]>();
  for (const c of cards) map.set(c.institutionId ?? null, [...(map.get(c.institutionId ?? null) ?? []), c]);
  return [...map.entries()].map(([institutionId, list]) => ({ institutionId, cards: list }));
}

export function createCard(ds: Dataset, dto: SaveCardDTO): CreditCard {
  validateCard(ds, dto);
  const c: StoredCard = { id: nextId(ds), name: dto.name?.trim() || null, cardLimit: round2(dto.cardLimit), closeDay: dto.closeDay, invoiceDueDay: dto.invoiceDueDay, institutionId: dto.institutionId ?? null, standardPaymentAccountId: dto.standardPaymentAccountId, active: true, createdAt: nowISO() };
  ds.cards.push(c);
  return new Ledger(ds).toCard(c);
}

/** Freezes the dates of closed cycles so that history is preserved across a cycle change. */
function freezeHistory(ds: Dataset, card: StoredCard, today: ISODate): void {
  for (const c of buildCycles(ds, card, today)) {
    if (c.status !== "CLOSED") continue;
    const row = materialize(ds, card, c.key);
    row.closeDate ??= c.closeDate;
    row.dueDate ??= c.dueDate;
  }
}

export function updateCard(ds: Dataset, id: Id, dto: SaveCardDTO): CreditCard {
  validateCard(ds, dto);
  const c = findCard(ds, id);
  const today = new Ledger(ds).today;
  if (dto.closeDay !== c.closeDay || dto.invoiceDueDay !== c.invoiceDueDay) {
    freezeHistory(ds, c, today);
    // Open/future rows that were not corrected by hand follow the new cycle.
    for (const row of ds.invoices.filter((i) => i.creditCardId === c.id)) {
      const cycle = buildCycles(ds, c, today).find((x) => x.key === row.key);
      if (cycle && cycle.status !== "CLOSED") {
        if (!row.closeDayPinned) row.closeDate = null;
        if (!row.dueDatePinned) row.dueDate = null;
      }
    }
  }
  Object.assign(c, { name: dto.name?.trim() || null, cardLimit: round2(dto.cardLimit), closeDay: dto.closeDay, invoiceDueDay: dto.invoiceDueDay, institutionId: dto.institutionId ?? null, standardPaymentAccountId: dto.standardPaymentAccountId, updatedAt: nowISO() });
  return new Ledger(ds).toCard(c);
}

export function simulateCycleChange(ds: Dataset, id: Id, closeDay: number, invoiceDueDay: number): InvoiceCycleChange {
  const card = findCard(ds, id);
  const today = new Ledger(ds).today;
  const current = buildCycles(ds, card, today);
  const draft = structuredClone(ds);
  const draftCard = draft.cards.find((x) => x.id === id)!;
  updateCard(draft, id, { ...draftCard, closeDay, invoiceDueDay });
  const next = buildCycles(draft, draftCard, today);

  const releaseKey = (cycles: Cycle[]) => {
    const m = new Map<Id, string>();
    for (const c of cycles) for (const r of c.releases) m.set(r.id, c.key);
    return m;
  };
  const before = releaseKey(current);
  const after = releaseKey(next);
  let changing = 0;
  for (const [rid, key] of after) if (before.get(rid) !== key) changing++;

  const upcoming = next.filter((c) => c.status !== "CLOSED");
  const shown = upcoming.slice(0, 4);
  return {
    movesReleases: changing > 0,
    releasesChangingInvoice: changing,
    totalInvoices: upcoming.filter((c) => c.key <= (upcoming[11]?.key ?? "9999")).length,
    invoices: shown.map((c, i) => {
      const days = cycleDays(c.firstDay, c.closeDate);
      return { referenceMonth: c.referenceMonth, firstDay: c.firstDay, closeDay: c.closeDate, dueDate: c.dueDate, days, transition: i === 0, outsideCycleWindow: isAtypicalCycle(days) };
    }),
  };
}

function hasCardLinks(ds: Dataset, id: Id): boolean {
  return ds.releases.some((r) => r.creditCardId === id) || ds.payments.some((p) => p.creditCardId === id);
}

export function deleteCard(ds: Dataset, id: Id): void {
  findCard(ds, id);
  if (hasCardLinks(ds, id)) throw new ApiError(400, { code: "LINKED_REGISTERS" });
  ds.cards = ds.cards.filter((c) => c.id !== id);
  ds.invoices = ds.invoices.filter((i) => i.creditCardId !== id);
}

export function setCardActive(ds: Dataset, id: Id, active: boolean): void {
  const c = findCard(ds, id);
  c.active = active;
  c.updatedAt = nowISO();
}

/* ───── invoices ───── */

function toOption(c: Cycle): InvoiceOption {
  return {
    invoiceId: c.row?.id ?? null,
    referenceMonth: c.referenceMonth,
    sharesReferenceMonth: c.sharesReferenceMonth,
    firstDay: c.firstDay,
    closeDay: c.closeDate,
    dueDate: c.dueDate,
    status: c.status,
    settled: c.settled,
    amount: c.amount,
    outstanding: c.outstanding,
  };
}

function prepare(ds: Dataset, cardId: Id): { card: StoredCard; cycles: Cycle[]; ledger: Ledger } {
  const card = findCard(ds, cardId);
  const ledger0 = new Ledger(ds);
  ensureRows(ds, card, ledger0.today);
  const ledger = new Ledger(ds);
  return { card, cycles: ledger.cyclesOf(card), ledger };
}

export function invoicesByCard(ds: Dataset, cardId: Id): InvoiceOption[] {
  const { cycles } = prepare(ds, cardId);
  const firstUsed = cycles.findIndex((c) => c.releases.length > 0 || c.payments.length > 0 || c.status !== "CLOSED");
  return cycles.slice(Math.max(0, firstUsed)).map(toOption);
}

function paymentDTO(ledger: Ledger, p: StoredPayment, cycle: Cycle | undefined): InvoicePayment {
  const acc = ledger.account(p.accountId);
  return {
    id: p.id,
    creditCardId: p.creditCardId,
    monthYear: cycle?.referenceMonth ?? "",
    paymentAccountId: p.accountId,
    paymentAccountName: acc ? ledger.accountLabel(acc) : "Conta",
    paymentAccountInstitutionId: acc?.institutionId ?? null,
    paymentAmount: p.amount,
    paymentDate: p.date,
    paymentHour: p.hour ?? null,
    attachmentName: p.attachment?.name ?? null,
  };
}

export function cycleValues(ds: Dataset, cardId: Id, closeDate: ISODate): InvoiceCycleValues {
  const { card, cycles, ledger } = prepare(ds, cardId);
  const idx = (() => {
    const c = findCycleByClose(cycles, closeDate);
    return c ? cycles.indexOf(c) : -1;
  })();
  if (idx < 0) {
    // Navigation beyond the generated horizon: synthesise an empty projected cycle.
    const key = closeDate.slice(0, 7);
    const close = naturalClose(card, key);
    return {
      invoiceId: null,
      referenceMonth: naturalDue(card, key).slice(5, 7) + "/" + naturalDue(card, key).slice(0, 4),
      sharesReferenceMonth: false,
      firstDay: addDaysISO(naturalClose(card, shiftMonthKey(key, -1)), 1),
      closeDay: close,
      dueDate: naturalDue(card, key),
      status: "FUTURE",
      settled: false,
      amount: 0,
      outstanding: 0,
      composition: { previousBalance: 0, purchases: 0, installments: 0 },
      releases: [],
      payments: [],
      settledByDueDate: null,
      canPay: false,
      canEditDates: false,
      closeDayPinned: false,
      dueDatePinned: false,
      previousCloseDate: naturalClose(card, shiftMonthKey(key, -1)),
      nextCloseDate: naturalClose(card, shiftMonthKey(key, 1)),
    };
  }
  const c = cycles[idx];
  const prev = cycles[idx - 1];
  const next = cycles[idx + 1];
  return {
    ...toOption(c),
    composition: { previousBalance: c.previousBalance, purchases: c.purchases, installments: c.installments },
    releases: c.releases.map((r) => ledger.toMonthly(r)),
    payments: c.payments.map((p) => paymentDTO(ledger, p, c)).sort((a, b) => a.paymentDate.localeCompare(b.paymentDate)),
    settledByDueDate: c.settledByDueDate,
    canPay: c.status !== "FUTURE" && c.outstanding > 0.004,
    canEditDates: c.row != null,
    closeDayPinned: c.row?.closeDayPinned ?? false,
    dueDatePinned: c.row?.dueDatePinned ?? false,
    previousCloseDate: prev?.closeDate ?? addDaysISO(c.firstDay, -1),
    nextCloseDate: next?.closeDate ?? naturalClose(card, shiftMonthKey(c.key, 1)),
  };
}

function validatePayment(ds: Dataset, cycle: Cycle, amount: number, date: ISODate, accountId: Id, today: ISODate, editingId?: Id): void {
  if (date > today) throw bad("payment date cannot be in the future");
  const acc = ds.accounts.find((a) => a.id === accountId);
  if (!acc || acc.primaryAccountId != null) throw bad("invalid payment account");
  const others = cycle.payments.filter((p) => p.id !== editingId).reduce((s, p) => s + p.amount, 0);
  if (others + amount > cycle.amount + 0.004) throw bad("payment exceeds invoice amount");
}

export function addPayment(ds: Dataset, dto: SaveInvoicePaymentDTO): InvoicePayment {
  const { card, cycles, ledger } = prepare(ds, dto.creditCardId);
  const cycle = findCycleByClose(cycles, dto.closeDate);
  if (!cycle) throw bad("invoice not found");
  validatePayment(ds, cycle, dto.paymentAmount, dto.paymentDate, dto.paymentAccountId, ledger.today);
  const row = materialize(ds, card, cycle.key);
  const p: StoredPayment = { id: nextId(ds), creditCardId: card.id, invoiceId: row.id, accountId: dto.paymentAccountId, amount: round2(dto.paymentAmount), date: dto.paymentDate, hour: dto.paymentHour || null, attachment: null, createdAt: nowISO() };
  ds.payments.push(p);
  return paymentDTO(new Ledger(ds), p, cycle);
}

export function editPayment(ds: Dataset, id: Id, dto: Omit<SaveInvoicePaymentDTO, "creditCardId" | "closeDate">): InvoicePayment {
  const p = ds.payments.find((x) => x.id === id);
  if (!p) throw new ApiError(404, { errorDescription: "payment not found" });
  const { card, cycles, ledger } = prepare(ds, p.creditCardId);
  const row = ds.invoices.find((i) => i.id === p.invoiceId);
  const cycle = cycles.find((c) => c.key === row?.key);
  if (!cycle) throw bad("invoice not found");
  validatePayment(ds, cycle, dto.paymentAmount, dto.paymentDate, dto.paymentAccountId, ledger.today, p.id);
  Object.assign(p, { accountId: dto.paymentAccountId, amount: round2(dto.paymentAmount), date: dto.paymentDate, hour: dto.paymentHour || null });
  void card;
  return paymentDTO(new Ledger(ds), p, cycle);
}

export function deletePayment(ds: Dataset, id: Id): void {
  ds.payments = ds.payments.filter((p) => p.id !== id);
}

export function setPaymentAttachment(ds: Dataset, id: Id, file: Attachment | null): void {
  const p = ds.payments.find((x) => x.id === id);
  if (!p) throw new ApiError(404, { errorDescription: "payment not found" });
  p.attachment = file;
}

export function getPaymentAttachment(ds: Dataset, id: Id): Attachment | null {
  return ds.payments.find((x) => x.id === id)?.attachment ?? null;
}

/* ───── date correction (§5.8b) ───── */

function correctionContext(ds: Dataset, invoiceId: Id) {
  const row = ds.invoices.find((i) => i.id === invoiceId);
  if (!row) throw new ApiError(404, { errorDescription: "invoice not found" });
  const { card, cycles } = prepare(ds, row.creditCardId);
  const idx = cycles.findIndex((c) => c.key === row.key);
  return { row, card, cycles, idx, cycle: cycles[idx], prev: cycles[idx - 1], next: cycles[idx + 1] };
}

function validateCorrection(ctx: ReturnType<typeof correctionContext>, change: { closeDay?: ISODate | null; dueDate?: ISODate | null }) {
  const close = change.closeDay ?? ctx.cycle.closeDate;
  const due = change.dueDate ?? ctx.cycle.dueDate;
  if (ctx.prev && close <= ctx.prev.closeDate) throw bad("close date must be after previous close");
  if (ctx.next && close >= ctx.next.closeDate) throw bad("close date must be before next close");
  if (due < close) throw bad("due date before close date");
}

export function simulateDateChange(ds: Dataset, invoiceId: Id, change: { closeDay?: ISODate | null; dueDate?: ISODate | null }): InvoiceCycleChange {
  const ctx = correctionContext(ds, invoiceId);
  validateCorrection(ctx, change);
  const draft = structuredClone(ds);
  applyCorrection(draft, invoiceId, change, true);
  const draftCard = draft.cards.find((c) => c.id === ctx.card.id)!;
  const today = new Ledger(ds).today;
  const after = buildCycles(draft, draftCard, today);
  const beforeMap = new Map<Id, string>();
  for (const c of ctx.cycles) for (const r of c.releases) beforeMap.set(r.id, c.key);
  let changing = 0;
  for (const c of after) for (const r of c.releases) if (beforeMap.get(r.id) !== c.key) changing++;
  const idx = after.findIndex((c) => c.key === ctx.row.key);
  const shown = after.slice(idx, idx + 2);
  return {
    movesReleases: changing > 0,
    releasesChangingInvoice: changing,
    totalInvoices: shown.length,
    invoices: shown.map((c, i) => {
      const days = cycleDays(c.firstDay, c.closeDate);
      return { referenceMonth: c.referenceMonth, firstDay: c.firstDay, closeDay: c.closeDate, dueDate: c.dueDate, days, transition: i === 0, outsideCycleWindow: isAtypicalCycle(days) };
    }),
  };
}

function applyCorrection(ds: Dataset, invoiceId: Id, change: { closeDay?: ISODate | null; dueDate?: ISODate | null }, skipChecks = false): void {
  const row = ds.invoices.find((i) => i.id === invoiceId)!;
  if (change.closeDay) {
    row.closeDate = change.closeDay;
    row.closeDayPinned = true;
  }
  if (change.dueDate) {
    row.dueDate = change.dueDate;
    row.dueDatePinned = true;
  }
  void skipChecks;
}

export function updateInvoiceDates(ds: Dataset, invoiceId: Id, change: { closeDay?: ISODate | null; dueDate?: ISODate | null }, confirmed: boolean): { closeDate: ISODate } {
  const ctx = correctionContext(ds, invoiceId);
  validateCorrection(ctx, change);
  const thisHas = ctx.cycle.payments.length > 0;
  const nextHas = (ctx.next?.payments.length ?? 0) > 0;
  if (!confirmed && change.closeDay && (thisHas || nextHas)) {
    const details: InvoiceHasPaymentDetails = {
      thisInvoice: thisHas,
      nextInvoice: nextHas,
      nextReferenceMonth: ctx.next ? invoiceLabel({ referenceMonth: ctx.next.referenceMonth, sharesReferenceMonth: ctx.next.sharesReferenceMonth, closeDay: ctx.next.closeDate }) : undefined,
    };
    throw new ApiError(422, { code: "INVOICE_HAS_PAYMENT", details });
  }
  applyCorrection(ds, invoiceId, change);
  return { closeDate: change.closeDay ?? ctx.cycle.closeDate };
}

export function cycleLengthDays(firstDay: ISODate, closeDay: ISODate): number {
  return daysBetween(firstDay, closeDay) + 1;
}
