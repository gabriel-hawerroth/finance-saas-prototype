/** Account, piggy-bank and investment endpoints of the mock backend (§8.2). */
import { ApiError } from "@/domain/errors";
import { round2 } from "@/lib/utils";
import type {
  Account,
  AccountType,
  AccountTypeDefaults,
  AccountsOverallBalance,
  BalanceDifference,
  BasicAccount,
  Id,
  RedeemInvestmentDTO,
  SaveAccountDTO,
} from "@/domain/types";
import { WALLET_ID } from "./institutions";
import { Ledger } from "./ledger";
import { nextId, nowISO, type Dataset, type StoredAccount, type StoredRelease } from "./store";

const bad = (d: string) => new ApiError(400, { errorDescription: d });

export const TYPE_DEFAULTS: AccountTypeDefaults[] = [
  { type: "CHECKING", countsForOverallBalance: true, visibleInCashFlow: true },
  { type: "SAVING", countsForOverallBalance: true, visibleInCashFlow: true },
  { type: "BROKERAGE", countsForOverallBalance: true, visibleInCashFlow: false },
  { type: "BENEFIT", countsForOverallBalance: false, visibleInCashFlow: true },
  { type: "CASH", countsForOverallBalance: true, visibleInCashFlow: true },
];

function find(ds: Dataset, id: Id): StoredAccount {
  const a = ds.accounts.find((x) => x.id === id);
  if (!a) throw new ApiError(404, { errorDescription: "account not found" });
  return a;
}

export function listAccounts(ds: Dataset): Account[] {
  const ledger = new Ledger(ds);
  return ledger.orderedAccounts().map((a) => ledger.toAccount(a));
}

export function getAccount(ds: Dataset, id: Id): { account: Account; primaryAccount: Account | null } {
  const ledger = new Ledger(ds);
  const a = find(ds, id);
  const parent = a.primaryAccountId != null ? ledger.account(a.primaryAccountId) : undefined;
  return { account: ledger.toAccount(a), primaryAccount: parent ? ledger.toAccount(parent) : null };
}

export function basicList(ds: Dataset, showSubAccounts: boolean): BasicAccount[] {
  const ledger = new Ledger(ds);
  return ledger
    .orderedAccounts()
    .filter((a) => a.active && (showSubAccounts || a.primaryAccountId == null))
    .map((a) => ({ id: a.id, name: ledger.accountLabel(a), institutionId: a.institutionId ?? null, balance: ledger.balanceOf(a.id), type: a.type ?? null, primaryAccountId: a.primaryAccountId ?? null }));
}

export function overallBalance(ds: Dataset): AccountsOverallBalance {
  const ledger = new Ledger(ds);
  let available = 0;
  let saved = 0;
  let investments = 0;
  let benefitsOutside = 0;
  let total = 0;
  for (const a of ds.accounts) {
    if (!a.active) continue;
    const parent = a.primaryAccountId != null ? ledger.account(a.primaryAccountId) : undefined;
    if (parent && !parent.active) continue;
    const bal = ledger.balanceOf(a.id);
    total += bal;
    const counts = parent ? parent.countsForOverallBalance : a.countsForOverallBalance;
    const group = ledger.groupOf(a);
    if (!counts) {
      if (group === "BENEFITS") benefitsOutside += bal;
      continue;
    }
    if (group === "SAVED") saved += bal;
    else if (group === "INVESTMENTS") investments += bal;
    else available += bal;
  }
  return {
    overallBalance: round2(available + saved + investments),
    availableBalance: round2(available),
    savedBalance: round2(saved),
    investmentsBalance: round2(investments),
    benefitsOutsideBalance: round2(benefitsOutside),
    totalBalance: round2(total),
  };
}

function transfer(ds: Dataset, from: Id, to: Id, amount: number, description: string): StoredRelease {
  const r: StoredRelease = {
    id: nextId(ds),
    type: "T",
    amount: round2(amount),
    accountId: from,
    targetAccountId: to,
    date: new Ledger(ds).today,
    done: true,
    description,
    balanceAdjustment: false,
    countsInCashFlow: true,
    createdAt: nowISO(),
  };
  ds.releases.push(r);
  return r;
}

export function createAccount(ds: Dataset, dto: SaveAccountDTO): Account {
  const stamp = nowISO();
  if (dto.primaryAccountId != null) {
    const parent = find(ds, dto.primaryAccountId);
    const ledger = new Ledger(ds);
    if (!ledger.canHoldPiggyBanks(parent)) throw bad("account cannot hold piggy banks");
    if (!dto.name?.trim()) throw bad("piggy bank name required");
    const piggy: StoredAccount = {
      id: nextId(ds),
      name: dto.name.trim(),
      type: parent.type,
      institutionId: parent.institutionId ?? null,
      institutionName: parent.institutionName ?? null,
      countsForOverallBalance: parent.countsForOverallBalance,
      visibleInCashFlow: parent.visibleInCashFlow,
      active: true,
      primaryAccountId: parent.id,
      purpose: dto.purpose ?? "SAVINGS",
      goal: dto.goal && dto.goal > 0 ? dto.goal : null,
      initialBalance: 0,
      createdAt: stamp,
    };
    ds.accounts.push(piggy);
    if (dto.initialAmount && dto.initialAmount > 0) transfer(ds, parent.id, piggy.id, dto.initialAmount, `Guardar em ${piggy.name}`);
    return new Ledger(ds).toAccount(piggy);
  }
  if (!dto.name?.trim() && dto.institutionId == null && !dto.institutionName?.trim()) throw bad("name or institution required");
  if (dto.institutionId != null && dto.institutionName) throw bad("institution id and name are exclusive");
  const type: AccountType | null = dto.institutionId === WALLET_ID ? "CASH" : dto.type ?? null;
  if (!type) throw bad("type required");
  const a: StoredAccount = {
    id: nextId(ds),
    name: dto.name?.trim() || null,
    type,
    institutionId: dto.institutionId ?? null,
    institutionName: dto.institutionName?.trim() || null,
    accountNumber: type === "CASH" ? null : dto.accountNumber || null,
    agency: type === "CASH" ? null : dto.agency || null,
    countsForOverallBalance: dto.countsForOverallBalance,
    visibleInCashFlow: dto.visibleInCashFlow,
    active: true,
    initialBalance: round2(dto.balance ?? 0),
    createdAt: stamp,
  };
  ds.accounts.push(a);
  return new Ledger(ds).toAccount(a);
}

export function updateAccount(ds: Dataset, id: Id, dto: SaveAccountDTO): Account {
  const a = find(ds, id);
  const ledger = new Ledger(ds);
  const stamp = nowISO();

  // Moving a top-level account inside another one (it becomes a piggy bank).
  if (dto.primaryAccountId != null && a.primaryAccountId == null) {
    if (!ledger.canBecomePiggyBank(a)) throw bad("account cannot become a piggy bank");
    const parent = find(ds, dto.primaryAccountId);
    if (parent.id === a.id || !ledger.canHoldPiggyBanks(parent)) throw bad("invalid destination");
    a.primaryAccountId = parent.id;
    a.purpose = dto.purpose ?? "SAVINGS";
    a.name = a.name || ledger.accountDisplayName(a);
    a.countsForOverallBalance = parent.countsForOverallBalance;
    a.visibleInCashFlow = parent.visibleInCashFlow;
    a.updatedAt = stamp;
    return new Ledger(ds).toAccount(a);
  }

  if (a.primaryAccountId != null) {
    if (!dto.name?.trim()) throw bad("piggy bank name required");
    a.name = dto.name.trim();
    a.purpose = dto.purpose ?? a.purpose;
    a.goal = dto.goal && dto.goal > 0 ? dto.goal : null;
    a.updatedAt = stamp;
    return new Ledger(ds).toAccount(a);
  }

  if (!dto.name?.trim() && dto.institutionId == null && !dto.institutionName?.trim()) throw bad("name or institution required");
  const type = dto.institutionId === WALLET_ID ? "CASH" : dto.type ?? a.type;
  Object.assign(a, {
    name: dto.name?.trim() || null,
    type,
    institutionId: dto.institutionId ?? null,
    institutionName: dto.institutionId != null ? null : dto.institutionName?.trim() || null,
    accountNumber: type === "CASH" ? null : dto.accountNumber || null,
    agency: type === "CASH" ? null : dto.agency || null,
    countsForOverallBalance: dto.countsForOverallBalance,
    visibleInCashFlow: dto.visibleInCashFlow,
    updatedAt: stamp,
  });
  // Piggy banks follow the parent's balance/cash-flow options.
  for (const p of ds.accounts.filter((x) => x.primaryAccountId === a.id)) {
    p.countsForOverallBalance = a.countsForOverallBalance;
    p.visibleInCashFlow = a.visibleInCashFlow;
    p.type = a.type;
  }
  return new Ledger(ds).toAccount(a);
}

export function adjustBalance(ds: Dataset, id: Id, newBalance: number): Account {
  const a = find(ds, id);
  const ledger = new Ledger(ds);
  const diff = round2(newBalance - ledger.balanceOf(id));
  if (Math.abs(diff) > 0.004) {
    ds.releases.push({
      id: nextId(ds),
      type: diff > 0 ? "R" : "E",
      amount: Math.abs(diff),
      accountId: a.id,
      date: ledger.today,
      done: true,
      description: "Ajuste de saldo",
      balanceAdjustment: true,
      countsInCashFlow: false,
      createdAt: nowISO(),
    });
  }
  return new Ledger(ds).toAccount(a);
}

export function balanceDifference(ds: Dataset, id: Id, informed: number): BalanceDifference {
  find(ds, id);
  const current = new Ledger(ds).balanceOf(id);
  const amount = round2(informed - current);
  return { currentBalance: current, amount: Math.abs(amount), direction: Math.abs(amount) < 0.005 ? "NONE" : amount > 0 ? "UP" : "DOWN" };
}

export function redeem(ds: Dataset, dto: RedeemInvestmentDTO): void {
  const from = find(ds, dto.fromAccountId);
  find(ds, dto.toAccountId);
  if (!(dto.redeemedAmount > 0) || !(dto.receivedAmount > 0) || dto.receivedAmount > dto.redeemedAmount + 0.004) throw bad("invalid amounts");
  const tax = round2(dto.redeemedAmount - dto.receivedAmount);
  if (tax > 0.004 && dto.taxCategoryId == null) throw bad("tax category required");
  transfer(ds, from.id, dto.toAccountId, dto.redeemedAmount, dto.transferDescription || "Resgate de investimento");
  if (tax > 0.004) {
    ds.releases.push({
      id: nextId(ds),
      type: "E",
      amount: tax,
      accountId: dto.toAccountId,
      categoryId: dto.taxCategoryId,
      date: new Ledger(ds).today,
      done: true,
      description: dto.taxDescription || "Imposto sobre resgate",
      balanceAdjustment: false,
      countsInCashFlow: true,
      createdAt: nowISO(),
    });
  }
}

function hasLinks(ds: Dataset, ids: Set<Id>): boolean {
  return (
    ds.releases.some((r) => (r.accountId != null && ids.has(r.accountId)) || (r.targetAccountId != null && ids.has(r.targetAccountId))) ||
    ds.payments.some((p) => ids.has(p.accountId)) ||
    ds.cards.some((c) => ids.has(c.standardPaymentAccountId))
  );
}

export function deleteAccount(ds: Dataset, id: Id): void {
  find(ds, id);
  const ids = new Set([id, ...ds.accounts.filter((x) => x.primaryAccountId === id).map((x) => x.id)]);
  if (hasLinks(ds, ids)) throw new ApiError(400, { code: "LINKED_REGISTERS" });
  ds.accounts = ds.accounts.filter((x) => !ids.has(x.id));
}

export function inactivateAccount(ds: Dataset, id: Id): void {
  const a = find(ds, id);
  const ledger = new Ledger(ds);
  const stamp = nowISO();
  if (a.primaryAccountId != null) {
    const bal = ledger.balanceOf(a.id);
    if (bal < -0.004) throw new ApiError(400, { code: "PIGGY_BANK_NEGATIVE_BALANCE" });
    if (bal > 0.004) transfer(ds, a.id, a.primaryAccountId, bal, `Devolução de ${a.name ?? "cofrinho"}`);
    a.active = false;
    a.updatedAt = stamp;
    return;
  }
  const piggies = ds.accounts.filter((x) => x.primaryAccountId === a.id && x.active);
  if (piggies.some((p) => ledger.balanceOf(p.id) < -0.004)) throw new ApiError(400, { code: "PIGGY_BANK_NEGATIVE_BALANCE" });
  a.active = false;
  a.updatedAt = stamp;
  for (const p of piggies) {
    p.active = false;
    p.updatedAt = stamp;
  }
}

export function activateAccount(ds: Dataset, id: Id, subAccounts: Id[]): void {
  const a = find(ds, id);
  if (a.primaryAccountId != null) {
    const parent = find(ds, a.primaryAccountId);
    if (!parent.active) throw bad("parent account is archived");
  }
  a.active = true;
  a.updatedAt = nowISO();
  for (const p of ds.accounts.filter((x) => x.primaryAccountId === a.id && subAccounts.includes(x.id))) {
    p.active = true;
    p.updatedAt = nowISO();
  }
}
