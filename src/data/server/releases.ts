/** Cash-flow endpoints of the mock backend (§8.5). */
import { ApiError } from "@/domain/errors";
import { invoiceLabel } from "@/lib/format";
import { addDaysISO, addMonthsISO, monthBounds } from "@/lib/dates";
import { round2 } from "@/lib/utils";
import type {
  Attachment,
  FixedBy,
  Id,
  ISODate,
  InvoiceResolution,
  MonthlyRelease,
  PaidInvoiceConflictDetails,
  SaveReleaseDTO,
  SeriesScope,
} from "@/domain/types";
import { materialize, openCycle } from "./invoice-engine";
import { Ledger } from "./ledger";
import { nextId, nowISO, type Dataset, type StoredRelease } from "./store";

const bad = (description: string) => new ApiError(400, { errorDescription: description });

/* ───────── reads ───────── */

export function getMonthlyReleases(ds: Dataset, monthKey: string): MonthlyRelease[] {
  const { start, end } = monthBounds(monthKey);
  const ledger = new Ledger(ds);
  const rows = ds.releases.filter((r) => r.date >= start && r.date <= end).map((r) => ledger.toMonthly(r));
  const payments = ds.payments.filter((p) => p.date >= start && p.date <= end).map((p) => ledger.paymentToMonthly(p));
  return [...rows, ...payments];
}

export function getRelease(ds: Dataset, id: Id): MonthlyRelease {
  const r = ds.releases.find((x) => x.id === id);
  if (!r) throw new ApiError(404, { errorDescription: "release not found" });
  return new Ledger(ds).toMonthly(r);
}

export function getAttachment(ds: Dataset, id: Id): Attachment | null {
  return ds.releases.find((x) => x.id === id)?.attachment ?? null;
}

/* ───────── paid-invoice guard (§5.17) ───────── */

interface CycleSnap {
  cardId: Id;
  key: string;
  value: number;
  settled: boolean;
  paid: number;
  lastPaymentDate: ISODate | null;
  settledByLater: boolean;
  label: string;
  firstDay: ISODate;
  closeDay: ISODate;
  dueDate: ISODate;
  amount: number;
}

function snapshot(ds: Dataset): Map<string, CycleSnap> {
  const ledger = new Ledger(ds);
  const map = new Map<string, CycleSnap>();
  for (const card of ds.cards) {
    for (const c of ledger.cyclesOf(card)) {
      map.set(`${card.id}:${c.key}`, {
        cardId: card.id,
        key: c.key,
        value: round2(c.purchases + c.installments),
        settled: c.settled && (c.payments.length > 0 || c.settledByDueDate != null),
        paid: c.paid,
        lastPaymentDate: c.payments.map((p) => p.date).sort().at(-1) ?? null,
        settledByLater: c.settledByDueDate != null,
        label: invoiceLabel({ referenceMonth: c.referenceMonth, sharesReferenceMonth: c.sharesReferenceMonth, closeDay: c.closeDate }),
        firstDay: c.firstDay,
        closeDay: c.closeDate,
        dueDate: c.dueDate,
        amount: c.amount,
      });
    }
  }
  return map;
}

/**
 * Compares card cycles before/after a mutation. If a settled invoice changes, raises
 * 422 PAID_INVOICE unless the caller already answered; MOVE_TO_OPEN pins the entering
 * releases to the open invoice (keeping their dates).
 */
function guardPaidInvoices(
  before: Map<string, CycleSnap>,
  ds: Dataset,
  resolution: InvoiceResolution | undefined,
  touched: readonly StoredRelease[],
  releaseDate: ISODate,
): void {
  const after = snapshot(ds);
  const affected: { snap: CycleSnap; afterValue: number }[] = [];
  for (const [k, snap] of before) {
    if (!snap.settled) continue;
    const afterValue = after.get(k)?.value ?? 0;
    if (Math.abs(afterValue - snap.value) > 0.004) affected.push({ snap, afterValue });
  }
  if (affected.length === 0) return;
  affected.sort((a, b) => a.snap.closeDay.localeCompare(b.snap.closeDay));
  const canMove = affected.some((a) => a.afterValue > a.snap.value);

  if (!resolution) {
    const ledger = new Ledger(ds);
    const card = ledger.card(affected[0].snap.cardId);
    const open = card ? openCycle(ledger.cyclesOf(card)) : undefined;
    const details: PaidInvoiceConflictDetails = {
      invoices: affected.map(({ snap, afterValue }) => ({
        label: snap.label,
        firstDay: snap.firstDay,
        closeDay: snap.closeDay,
        dueDate: snap.dueDate,
        lastPaymentDate: snap.lastPaymentDate,
        settledByLater: snap.settledByLater && snap.paid < snap.amount,
        paidAmount: snap.paid,
        outstandingAfter: round2(snap.amount + (afterValue - snap.value) - snap.paid),
        entering: afterValue > snap.value,
      })),
      affectedInvoices: affected.length,
      canMove,
      target: open ? { label: invoiceLabel({ referenceMonth: open.referenceMonth, sharesReferenceMonth: open.sharesReferenceMonth, closeDay: open.closeDate }) } : null,
      releaseDate,
    };
    throw new ApiError(422, { code: "PAID_INVOICE", details });
  }

  if (resolution === "MOVE_TO_OPEN" && canMove) {
    const ledger = new Ledger(ds);
    const enteringKeys = new Set(affected.filter((a) => a.afterValue > a.snap.value).map((a) => `${a.snap.cardId}:${a.snap.key}`));
    for (const r of touched) {
      const card = ledger.card(r.creditCardId);
      if (!card) continue;
      const cycles = ledger.cyclesOf(card);
      const cycle = cycles.find((c) => c.releases.some((x) => x.id === r.id));
      const open = openCycle(cycles);
      if (cycle && open && enteringKeys.has(`${card.id}:${cycle.key}`)) {
        const stored = ds.releases.find((x) => x.id === r.id);
        if (stored) stored.pinnedInvoiceKey = open.key;
      }
    }
  }
}

/* ───────── validation ───────── */

function validate(ds: Dataset, dto: SaveReleaseDTO, selfId?: Id): void {
  if (!(dto.amount > 0)) throw bad("amount must be greater than zero");
  if (dto.description && dto.description.length > 50) throw bad("description too long");
  if (dto.observation && dto.observation.length > 100) throw bad("observation too long");
  const hasAcc = dto.accountId != null;
  const hasCard = dto.creditCardId != null;
  if (hasAcc === hasCard) throw bad("release needs an account or a card");
  if (hasCard && dto.type !== "E") throw bad("cards only accept expenses");
  if (dto.type === "T") {
    if (dto.targetAccountId == null) throw bad("target account required");
    if (dto.targetAccountId === dto.accountId) throw bad("source and target must differ");
  }
  if (dto.type !== "T" && !dto.reimbursedReleaseId && dto.categoryId == null) throw bad("category required");
  if (dto.subcategoryId != null) {
    const sub = ds.subcategories.find((s) => s.id === dto.subcategoryId);
    if (!sub || sub.categoryId !== dto.categoryId) throw bad("subcategory does not belong to category");
  }
  if (dto.reimbursedReleaseId != null) {
    const parent = ds.releases.find((r) => r.id === dto.reimbursedReleaseId);
    if (!parent || parent.type !== "E") throw bad("reimbursed release must be an expense");
    if (!parent.done) throw new ApiError(400, { code: "REIMBURSED_EXPENSE_NOT_DONE" });
    const others = ds.releases.filter((r) => r.reimbursedReleaseId === parent.id && r.id !== selfId).reduce((s, r) => s + r.amount, 0);
    if (others + dto.amount > parent.amount + 0.004) throw new ApiError(400, { code: "REIMBURSEMENT_EXCEEDS_EXPENSE" });
  }
}

function stepDate(date: ISODate, fixedBy: FixedBy, k: number): ISODate {
  switch (fixedBy) {
    case "DAILY":
      return addDaysISO(date, k);
    case "WEEKLY":
      return addDaysISO(date, 7 * k);
    case "MONTHLY":
      return addMonthsISO(date, k);
    case "BIMONTHLY":
      return addMonthsISO(date, 2 * k);
    case "QUARTERLY":
      return addMonthsISO(date, 3 * k);
    case "BIANNUAL":
      return addMonthsISO(date, 6 * k);
    case "ANNUAL":
      return addMonthsISO(date, 12 * k);
  }
}

function baseFromDTO(dto: SaveReleaseDTO) {
  const isCard = dto.creditCardId != null;
  return {
    type: dto.type,
    description: dto.description?.trim() || null,
    amount: round2(dto.amount),
    accountId: isCard ? null : dto.accountId ?? null,
    creditCardId: isCard ? dto.creditCardId : null,
    targetAccountId: dto.type === "T" ? dto.targetAccountId ?? null : null,
    categoryId: dto.type === "T" || dto.reimbursedReleaseId ? null : dto.categoryId ?? null,
    subcategoryId: dto.type === "T" || dto.reimbursedReleaseId ? null : dto.subcategoryId ?? null,
    time: dto.time || null,
    observation: dto.observation?.trim() || null,
    countsInCashFlow: dto.type === "T" ? true : dto.countsInCashFlow,
    reimbursedReleaseId: dto.reimbursedReleaseId ?? null,
  };
}

/* ───────── writes ───────── */

export function createRelease(ds: Dataset, dto: SaveReleaseDTO, repeatFor: number, resolution?: InvoiceResolution): { id: Id } {
  validate(ds, dto);
  const before = snapshot(ds);
  const base = baseFromDTO(dto);
  const created: StoredRelease[] = [];
  const stamp = nowISO();
  const today = new Ledger(ds).today;

  if (dto.repeat && repeatFor >= 2 && !dto.reimbursedReleaseId) {
    const seriesId = `s-${nextId(ds)}`;
    if (dto.repeat === "INSTALLMENTS") {
      if (dto.type !== "E") throw bad("installments only for expenses");
      for (let k = 0; k < repeatFor; k++) {
        created.push({ ...base, id: nextId(ds), date: addMonthsISO(dto.date, k), purchaseDate: dto.date, done: dto.done, seriesId, repeat: "INSTALLMENTS", installmentNumber: k + 1, totalInstallments: repeatFor, balanceAdjustment: false, createdAt: stamp });
      }
    } else {
      const fixedBy = dto.fixedBy ?? "MONTHLY";
      for (let k = 0; k < repeatFor; k++) {
        const date = stepDate(dto.date, fixedBy, k);
        created.push({ ...base, id: nextId(ds), date, done: k === 0 ? dto.done : date <= today && dto.done, seriesId, repeat: "FIXED", fixedBy, balanceAdjustment: false, createdAt: stamp });
      }
    }
  } else {
    created.push({ ...base, id: nextId(ds), date: dto.date, done: dto.done, balanceAdjustment: false, createdAt: stamp });
  }
  ds.releases.push(...created);
  guardPaidInvoices(before, ds, resolution, created, dto.date);
  return { id: created[0].id };
}

function seriesTargets(ds: Dataset, r: StoredRelease, scope: SeriesScope): StoredRelease[] {
  if (!r.seriesId || scope === "JUST_THIS" || scope === "UNNECESSARY") return [r];
  const siblings = ds.releases.filter((x) => x.seriesId === r.seriesId);
  if (scope === "ALL") return siblings;
  return siblings.filter((x) => x.date > r.date || (x.date === r.date && x.id >= r.id) || (x.installmentNumber ?? 0) >= (r.installmentNumber ?? Infinity));
}

export function updateRelease(ds: Dataset, id: Id, dto: SaveReleaseDTO, scope: SeriesScope, resolution?: InvoiceResolution): { id: Id } {
  const r = ds.releases.find((x) => x.id === id);
  if (!r) throw new ApiError(404, { errorDescription: "release not found" });
  if (r.balanceAdjustment) throw bad("balance adjustments are not editable");
  validate(ds, { ...dto, type: r.type }, r.id);
  const reimb = ds.releases.filter((x) => x.reimbursedReleaseId === r.id);
  if (reimb.length) {
    if (dto.amount + 0.004 < reimb.reduce((s, x) => s + x.amount, 0)) throw new ApiError(400, { code: "EXPENSE_BELOW_REIMBURSEMENTS" });
    if (!dto.done) throw new ApiError(400, { code: "REIMBURSED_EXPENSE_MUST_STAY_DONE" });
  }
  const before = snapshot(ds);
  const base = baseFromDTO({ ...dto, type: r.type, reimbursedReleaseId: r.reimbursedReleaseId });
  const stamp = nowISO();
  const touched: StoredRelease[] = [];

  if (r.installmentNumber && r.seriesId) {
    const siblings = ds.releases.filter((x) => x.seriesId === r.seriesId);
    const purchaseDate = dto.purchaseDate ?? r.purchaseDate ?? r.date;
    const purchaseChanged = purchaseDate !== r.purchaseDate;
    for (const s of siblings) {
      s.description = base.description;
      s.categoryId = base.categoryId;
      s.subcategoryId = base.subcategoryId;
      s.observation = base.observation;
      s.time = base.time;
      s.countsInCashFlow = base.countsInCashFlow;
      s.purchaseDate = purchaseDate;
      s.updatedAt = stamp;
    }
    if (base.creditCardId != null) {
      for (const s of siblings) {
        s.creditCardId = base.creditCardId;
        s.accountId = null;
        if (purchaseChanged) s.date = addMonthsISO(purchaseDate, (s.installmentNumber ?? 1) - 1);
      }
      touched.push(...siblings);
    } else {
      if (r.creditCardId != null) {
        for (const s of siblings) {
          s.accountId = base.accountId;
          s.creditCardId = null;
          s.pinnedInvoiceKey = null;
        }
        touched.push(...siblings);
      } else {
        r.accountId = base.accountId;
        touched.push(r);
      }
      r.date = dto.date;
    }
    r.amount = base.amount;
    r.done = dto.done;
  } else if (r.seriesId) {
    if (scope !== "JUST_THIS" && dto.date !== r.date) throw bad("date must stay the same when editing several releases");
    const targets = seriesTargets(ds, r, scope);
    for (const t of targets) {
      Object.assign(t, { ...base, date: t === r ? dto.date : t.date, done: t === r ? dto.done : t.done, updatedAt: stamp });
    }
    touched.push(...targets);
  } else {
    Object.assign(r, { ...base, date: dto.date, done: dto.done, updatedAt: stamp });
    if (r.creditCardId == null) r.pinnedInvoiceKey = null;
    touched.push(r);
  }
  guardPaidInvoices(before, ds, resolution, touched, dto.date);
  return { id: r.id };
}

export function deleteRelease(ds: Dataset, id: Id, scope: SeriesScope, resolution?: InvoiceResolution): void {
  const r = ds.releases.find((x) => x.id === id);
  if (!r) throw new ApiError(404, { errorDescription: "release not found" });
  const targets = seriesTargets(ds, r, scope);
  if (targets.some((t) => ds.releases.some((x) => x.reimbursedReleaseId === t.id))) {
    throw new ApiError(400, { code: "EXPENSE_HAS_REIMBURSEMENTS" });
  }
  const before = snapshot(ds);
  const ids = new Set(targets.map((t) => t.id));
  ds.releases = ds.releases.filter((x) => !ids.has(x.id));
  guardPaidInvoices(before, ds, resolution, [], r.date);
}

export function updateDone(ds: Dataset, id: Id, done: boolean, resolution?: InvoiceResolution): void {
  const r = ds.releases.find((x) => x.id === id);
  if (!r) throw new ApiError(404, { errorDescription: "release not found" });
  if (!done && ds.releases.some((x) => x.reimbursedReleaseId === r.id)) {
    throw new ApiError(400, { code: "REIMBURSED_EXPENSE_MUST_STAY_DONE" });
  }
  const before = snapshot(ds);
  r.done = done;
  r.updatedAt = nowISO();
  guardPaidInvoices(before, ds, resolution, [r], r.date);
}

export function updateReleaseInvoice(
  ds: Dataset,
  id: Id,
  target: { invoiceId?: Id | null; closeDate?: ISODate | null } | null,
  resolution?: InvoiceResolution,
): { invoiceId: Id | null } {
  const r = ds.releases.find((x) => x.id === id);
  if (!r || r.creditCardId == null) throw bad("only card releases have invoices");
  const ledger = new Ledger(ds);
  const card = ledger.card(r.creditCardId)!;
  const cycles = ledger.cyclesOf(card);
  const before = snapshot(ds);
  let key: string | null = null;
  if (target?.invoiceId != null) key = ds.invoices.find((i) => i.id === target.invoiceId)?.key ?? null;
  else if (target?.closeDate) key = cycles.find((c) => c.closeDate === target.closeDate)?.key ?? null;
  if (target && !key) throw bad("invoice not found");
  r.pinnedInvoiceKey = key;
  r.updatedAt = nowISO();
  guardPaidInvoices(before, ds, resolution, [r], r.date);
  const finalKey = r.pinnedInvoiceKey ?? new Ledger(ds).cycleOfRelease(r)?.key;
  const row = finalKey ? materialize(ds, card, finalKey) : null;
  return { invoiceId: row?.id ?? null };
}

export function setReleaseAttachment(ds: Dataset, id: Id, file: Attachment | null): void {
  const r = ds.releases.find((x) => x.id === id);
  if (!r) throw new ApiError(404, { errorDescription: "release not found" });
  r.attachment = file;
}
