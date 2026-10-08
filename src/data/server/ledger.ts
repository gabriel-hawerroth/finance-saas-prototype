/**
 * Derived reads of the mock backend: balances, account projections and the
 * monthly-release projection. A `Ledger` is built once per request so that
 * balances and card cycles are computed only once.
 */
import { todayISO } from "@/lib/dates";
import { round2 } from "@/lib/utils";
import type { Account, AccountGroup, CreditCard, Id, MonthlyRelease, RefName } from "@/domain/types";
import { buildCycles, cardSummary, type Cycle } from "./invoice-engine";
import { INSTITUTIONS } from "./institutions";
import type { Dataset, StoredAccount, StoredCard, StoredPayment, StoredRelease } from "./store";

export class Ledger {
  readonly today = todayISO();
  private balances?: Map<Id, number>;
  private cycles = new Map<Id, Cycle[]>();
  private reimbursements?: Map<Id, StoredRelease[]>;

  constructor(readonly ds: Dataset) {}

  /* ───── balances ───── */

  balanceOf(accountId: Id): number {
    if (!this.balances) this.balances = computeBalances(this.ds);
    return this.balances.get(accountId) ?? 0;
  }

  /* ───── lookup ───── */

  account(id: Id | null | undefined): StoredAccount | undefined {
    return id == null ? undefined : this.ds.accounts.find((a) => a.id === id);
  }
  card(id: Id | null | undefined): StoredCard | undefined {
    return id == null ? undefined : this.ds.cards.find((c) => c.id === id);
  }

  accountDisplayName(a: StoredAccount): string {
    if (a.name) return a.name;
    if (a.institutionId != null) return INSTITUTIONS.find((i) => i.id === a.institutionId)?.name ?? "Conta";
    return a.institutionName ?? "Conta";
  }

  /** Label with parent for piggy banks ("Conta › Cofrinho"). */
  accountLabel(a: StoredAccount): string {
    if (a.primaryAccountId != null) {
      const parent = this.account(a.primaryAccountId);
      return parent ? `${this.accountDisplayName(parent)} › ${this.accountDisplayName(a)}` : this.accountDisplayName(a);
    }
    return this.accountDisplayName(a);
  }

  cardDisplayName(c: StoredCard): string {
    if (c.name) return c.name;
    return INSTITUTIONS.find((i) => i.id === c.institutionId)?.name ?? "Cartão";
  }

  /* ───── accounts ───── */

  groupOf(a: StoredAccount): AccountGroup {
    if (a.primaryAccountId != null) return a.purpose === "INVESTMENT" ? "INVESTMENTS" : "SAVED";
    if (a.type === "BROKERAGE") return "INVESTMENTS";
    if (a.type === "BENEFIT") return "BENEFITS";
    return "AVAILABLE";
  }

  canHoldPiggyBanks(a: StoredAccount): boolean {
    return a.primaryAccountId == null && a.active && (a.type === "CHECKING" || a.type === "SAVING" || a.type == null);
  }

  canBecomePiggyBank(a: StoredAccount): boolean {
    if (a.primaryAccountId != null || !a.active) return false;
    if (a.type === "BROKERAGE" || a.type === "BENEFIT" || a.type === "CASH") return false;
    if (this.ds.accounts.some((x) => x.primaryAccountId === a.id)) return false;
    if (this.ds.cards.some((c) => c.standardPaymentAccountId === a.id)) return false;
    return true;
  }

  toAccount(a: StoredAccount): Account {
    return {
      id: a.id,
      name: a.name ?? null,
      displayName: this.accountDisplayName(a),
      balance: this.balanceOf(a.id),
      type: a.type ?? null,
      institutionId: a.institutionId ?? null,
      institutionName: a.institutionName ?? null,
      accountNumber: a.accountNumber ?? null,
      agency: a.agency ?? null,
      countsForOverallBalance: a.countsForOverallBalance,
      visibleInCashFlow: a.visibleInCashFlow,
      active: a.active,
      primaryAccountId: a.primaryAccountId ?? null,
      purpose: a.purpose ?? null,
      goal: a.goal ?? null,
      group: this.groupOf(a),
      canHoldPiggyBanks: this.canHoldPiggyBanks(a),
      canBecomePiggyBank: this.canBecomePiggyBank(a),
      createdAt: a.createdAt,
      updatedAt: a.updatedAt ?? null,
    };
  }

  /** Server order: top-level accounts by group then name, piggy banks right after their parent. */
  orderedAccounts(): StoredAccount[] {
    const order: Record<AccountGroup, number> = { AVAILABLE: 0, SAVED: 1, INVESTMENTS: 2, BENEFITS: 3 };
    const tops = this.ds.accounts
      .filter((a) => a.primaryAccountId == null)
      .sort((a, b) => Number(b.active) - Number(a.active) || order[this.groupOf(a)] - order[this.groupOf(b)] || this.balanceOf(b.id) - this.balanceOf(a.id));
    const result: StoredAccount[] = [];
    for (const t of tops) {
      result.push(t);
      result.push(...this.ds.accounts.filter((p) => p.primaryAccountId === t.id).sort((a, b) => a.id - b.id));
    }
    return result;
  }

  /* ───── cards ───── */

  cyclesOf(card: StoredCard): Cycle[] {
    let c = this.cycles.get(card.id);
    if (!c) {
      c = buildCycles(this.ds, card, this.today);
      this.cycles.set(card.id, c);
    }
    return c;
  }

  cycleOfRelease(r: StoredRelease): Cycle | undefined {
    const card = this.card(r.creditCardId);
    if (!card) return undefined;
    return this.cyclesOf(card).find((c) => c.releases.includes(r));
  }

  toCard(c: StoredCard): CreditCard {
    const payAcc = this.account(c.standardPaymentAccountId);
    return {
      id: c.id,
      name: c.name ?? null,
      displayName: this.cardDisplayName(c),
      cardLimit: c.cardLimit,
      closeDay: c.closeDay,
      invoiceDueDay: c.invoiceDueDay,
      institutionId: c.institutionId ?? null,
      standardPaymentAccountId: c.standardPaymentAccountId,
      active: c.active,
      accountName: payAcc ? this.accountLabel(payAcc) : null,
      invoiceSummary: cardSummary(c, this.cyclesOf(c)),
      createdAt: c.createdAt,
      updatedAt: c.updatedAt ?? null,
    };
  }

  /* ───── releases ───── */

  reimbursementsOf(id: Id): StoredRelease[] {
    if (!this.reimbursements) {
      this.reimbursements = new Map();
      for (const r of this.ds.releases) {
        if (r.reimbursedReleaseId == null) continue;
        const list = this.reimbursements.get(r.reimbursedReleaseId) ?? [];
        list.push(r);
        this.reimbursements.set(r.reimbursedReleaseId, list);
      }
    }
    return this.reimbursements.get(id) ?? [];
  }

  private accRef(id: Id | null | undefined): RefName | null {
    const a = this.account(id);
    return a ? { id: a.id, name: this.accountLabel(a), active: a.active, institutionId: a.institutionId ?? null } : null;
  }

  countsInMonthTotals(r: StoredRelease): boolean {
    if (r.type === "T" || r.balanceAdjustment || !r.countsInCashFlow) return false;
    if (r.accountId != null) {
      const a = this.account(r.accountId);
      if (a && !a.visibleInCashFlow) return false;
    }
    return true;
  }

  toMonthly(r: StoredRelease): MonthlyRelease {
    const cat = r.categoryId != null ? this.ds.categories.find((c) => c.id === r.categoryId) : undefined;
    const sub = r.subcategoryId != null ? this.ds.subcategories.find((s) => s.id === r.subcategoryId) : undefined;
    const card = this.card(r.creditCardId);
    const reimb = this.reimbursementsOf(r.id);
    const reimbursedAmount = round2(reimb.filter((x) => x.done).reduce((s, x) => s + x.amount, 0));
    const allReimb = round2(reimb.reduce((s, x) => s + x.amount, 0));
    const cycle = card ? this.cycleOfRelease(r) : undefined;
    const parent = r.reimbursedReleaseId != null ? this.ds.releases.find((x) => x.id === r.reimbursedReleaseId) : undefined;
    const parentCat = parent?.categoryId != null ? this.ds.categories.find((c) => c.id === parent.categoryId) : undefined;
    return {
      key: `RELEASE-${r.id}`,
      id: r.id,
      kind: "RELEASE",
      type: r.type,
      description: r.description ?? null,
      amount: r.amount,
      account: this.accRef(r.accountId),
      card: card ? { id: card.id, name: this.cardDisplayName(card), active: card.active, institutionId: card.institutionId ?? null } : null,
      targetAccount: this.accRef(r.targetAccountId),
      category: cat ? { id: cat.id, name: cat.name, active: cat.active, color: cat.color, icon: cat.icon, type: cat.type } : null,
      subcategory: sub ? { id: sub.id, name: sub.name, active: sub.active } : null,
      date: r.date,
      time: r.time ?? null,
      purchaseDate: r.purchaseDate ?? null,
      done: r.done,
      observation: r.observation ?? null,
      attachmentName: r.attachment?.name ?? null,
      seriesId: r.seriesId ?? null,
      isDuplicatedRelease: r.seriesId != null,
      repeat: r.repeat ?? null,
      installmentNumber: r.installmentNumber ?? null,
      totalInstallments: r.totalInstallments ?? null,
      balanceAdjustment: r.balanceAdjustment,
      countsInCashFlow: r.countsInCashFlow,
      countsInMonthTotals: this.countsInMonthTotals(r),
      invoiceId: cycle?.row?.id ?? null,
      invoicePinned: Boolean(r.pinnedInvoiceKey),
      invoiceMonthYear: cycle?.referenceMonth ?? null,
      invoiceCloseDay: cycle?.closeDate ?? null,
      sharesReferenceMonth: cycle?.sharesReferenceMonth ?? false,
      reimbursedReleaseId: r.reimbursedReleaseId ?? null,
      reimbursedRelease: parent
        ? { id: parent.id, description: parent.description || parentCat?.name || "Despesa", amount: parent.amount, categoryName: parentCat?.name ?? null }
        : null,
      reimbursements: reimb.map((x) => ({ id: x.id, amount: x.amount, date: x.date, done: x.done })).sort((a, b) => a.date.localeCompare(b.date)),
      reimbursedAmount,
      netAmount: round2(r.amount - reimbursedAmount),
      reimbursableAmount: round2(Math.max(0, r.amount - allReimb)),
      canRegisterReimbursement: r.type === "E" && r.done && !r.balanceAdjustment && r.amount - allReimb > 0.004,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt ?? null,
    };
  }

  paymentToMonthly(p: StoredPayment): MonthlyRelease {
    const card = this.card(p.creditCardId);
    const row = this.ds.invoices.find((i) => i.id === p.invoiceId);
    const cycle = card && row ? this.cyclesOf(card).find((c) => c.key === row.key) : undefined;
    return {
      key: `INVOICE_PAYMENT-${p.id}`,
      id: p.id,
      kind: "INVOICE_PAYMENT",
      type: "E",
      description: null,
      amount: p.amount,
      account: this.accRef(p.accountId),
      card: card ? { id: card.id, name: this.cardDisplayName(card), active: card.active, institutionId: card.institutionId ?? null } : null,
      targetAccount: null,
      category: null,
      subcategory: null,
      date: p.date,
      time: p.hour ?? null,
      done: true,
      attachmentName: p.attachment?.name ?? null,
      isDuplicatedRelease: false,
      balanceAdjustment: false,
      countsInCashFlow: true,
      countsInMonthTotals: false,
      invoiceId: p.invoiceId,
      invoicePinned: false,
      invoiceMonthYear: cycle?.referenceMonth ?? null,
      invoiceCloseDay: cycle?.closeDate ?? null,
      sharesReferenceMonth: cycle?.sharesReferenceMonth ?? false,
      reimbursements: [],
      reimbursedAmount: 0,
      netAmount: p.amount,
      reimbursableAmount: 0,
      canRegisterReimbursement: false,
      createdAt: p.createdAt,
    };
  }
}

export function computeBalances(ds: Dataset): Map<Id, number> {
  const map = new Map<Id, number>();
  for (const a of ds.accounts) map.set(a.id, a.initialBalance);
  const add = (id: Id | null | undefined, v: number) => {
    if (id == null || !map.has(id)) return;
    map.set(id, (map.get(id) ?? 0) + v);
  };
  for (const r of ds.releases) {
    if (!r.done || r.creditCardId != null) continue;
    if (r.type === "R") add(r.accountId, r.amount);
    else if (r.type === "E") add(r.accountId, -r.amount);
    else if (r.type === "T") {
      add(r.accountId, -r.amount);
      add(r.targetAccountId, r.amount);
    }
  }
  for (const p of ds.payments) add(p.accountId, -p.amount);
  for (const [k, v] of map) map.set(k, round2(v));
  return map;
}
