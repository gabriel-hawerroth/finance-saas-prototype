import { normalize } from "@/lib/text";
import { clamp, round2 } from "@/lib/utils";
import { ACCOUNT_TYPE_SHORT } from "./constants";
import type { Account, AccountGroup, CreditCard, Id, Institution } from "./types";

/* ───────── Labels (§5.12, §5.5) ───────── */

export function institutionNameOf(account: Pick<Account, "institutionId" | "institutionName">, institutions: readonly Institution[]): string | null {
  if (account.institutionId != null) return institutions.find((i) => i.id === account.institutionId)?.name ?? null;
  return account.institutionName ?? null;
}

/** Label for pick lists: unnamed account = institution (+ " › Tipo" if ambiguous); piggy bank = "Conta › Cofrinho". */
export function accountOptionLabel(account: Account, all: readonly Account[], institutions: readonly Institution[]): string {
  if (account.primaryAccountId != null) {
    const parent = all.find((a) => a.id === account.primaryAccountId);
    return `${parent ? accountOptionLabel(parent, all, institutions) : "Conta"} › ${account.displayName}`;
  }
  if (account.name) return account.name;
  const inst = institutionNameOf(account, institutions) ?? account.displayName;
  const sameInst = all.filter(
    (a) =>
      a.primaryAccountId == null &&
      a.id !== account.id &&
      ((account.institutionId != null && a.institutionId === account.institutionId) ||
        (account.institutionName && normalize(a.institutionName) === normalize(account.institutionName))),
  );
  return sameInst.length > 0 && account.type ? `${inst} › ${ACCOUNT_TYPE_SHORT[account.type]}` : inst;
}

/** Title/subtitle without repeating names (§5.5). */
export function accountHeading(account: Account, all: readonly Account[], institutions: readonly Institution[]): { title: string; subtitle: string } {
  const inst = institutionNameOf(account, institutions);
  const typeLabel = account.type ? ACCOUNT_TYPE_SHORT[account.type] : "Conta";
  if (account.primaryAccountId != null) {
    const parent = all.find((a) => a.id === account.primaryAccountId);
    return { title: account.displayName, subtitle: `Cofrinho em ${parent ? accountOptionLabel(parent, all, institutions) : "conta"}` };
  }
  if (account.name && (!inst || normalize(account.name) !== normalize(inst))) {
    return { title: account.name, subtitle: inst ? `${inst} · ${typeLabel}` : typeLabel };
  }
  return { title: inst ?? account.displayName, subtitle: typeLabel };
}

/* ───────── C5, C6, C7 ───────── */

export function piggiesOf(account: Account, all: readonly Account[], includeArchived = true): Account[] {
  return all.filter((a) => a.primaryAccountId === account.id && (includeArchived || a.active));
}

/** C5 — account total = own balance + piggy banks (presentation only, never the overall balance). */
export function accountTotal(account: Account, all: readonly Account[]): number {
  return round2(account.balance + piggiesOf(account, all).filter((p) => p.active).reduce((s, p) => s + p.balance, 0));
}

/** C6 — goal progress = round(balance/goal × 100), clamped 0–100. */
export function goalProgress(balance: number, goal: number | null | undefined): number | null {
  if (!goal || goal <= 0) return null;
  return clamp(Math.round((balance / goal) * 100), 0, 100);
}

/** C7 — limit usage = (limit − available)/limit, clamped 0–100%. */
export function limitUsage(limit: number, available: number): number {
  if (limit <= 0) return 0;
  return clamp(((limit - available) / limit) * 100, 0, 100);
}

/* ───────── C14 — grouping by institution ───────── */

export interface AccountRow {
  account: Account;
  piggies: Account[];
  total: number;
}

export interface InstitutionGroup {
  key: string;
  institution: Institution | null;
  name: string;
  rows: AccountRow[];
  cards: CreditCard[];
  total: number;
  /** No account of the group counts for the overall balance. */
  outsideOverall: boolean;
}

function groupKeyOf(account: Account): string {
  if (account.institutionId != null) return `inst-${account.institutionId}`;
  if (account.institutionName) return `other-${normalize(account.institutionName)}`;
  return `acc-${account.id}`;
}

export function groupByInstitution(
  accounts: readonly Account[],
  cards: readonly CreditCard[],
  institutions: readonly Institution[],
  showArchived: boolean,
): InstitutionGroup[] {
  const tops = accounts.filter((a) => a.primaryAccountId == null && (showArchived || a.active));
  const groups = new Map<string, InstitutionGroup>();
  for (const account of tops) {
    const key = groupKeyOf(account);
    let g = groups.get(key);
    if (!g) {
      const institution = account.institutionId != null ? institutions.find((i) => i.id === account.institutionId) ?? null : null;
      g = {
        key,
        institution,
        name: institution?.name ?? account.institutionName ?? account.displayName,
        rows: [],
        cards: [],
        total: 0,
        outsideOverall: true,
      };
      groups.set(key, g);
    }
    const piggies = piggiesOf(account, accounts, showArchived);
    g.rows.push({ account, piggies, total: accountTotal(account, accounts) });
    if (account.active) {
      g.total = round2(g.total + accountTotal(account, accounts));
      if (account.countsForOverallBalance) g.outsideOverall = false;
    }
  }

  const leftover: CreditCard[] = [];
  for (const card of [...cards].filter((c) => c.active).sort((a, b) => a.displayName.localeCompare(b.displayName, "pt-BR"))) {
    let key: string | null = null;
    if (card.institutionId != null) {
      key = `inst-${card.institutionId}`;
      if (!groups.has(key)) {
        const institution = institutions.find((i) => i.id === card.institutionId) ?? null;
        groups.set(key, { key, institution, name: institution?.name ?? card.displayName, rows: [], cards: [], total: 0, outsideOverall: false });
      }
    } else {
      const payAcc = accounts.find((a) => a.id === card.standardPaymentAccountId);
      const k = payAcc ? groupKeyOf(payAcc) : null;
      key = k && groups.has(k) ? k : null;
    }
    if (key) groups.get(key)!.cards.push(card);
    else leftover.push(card);
  }

  const result = [...groups.values()];
  if (leftover.length) {
    result.push({ key: "other-cards", institution: null, name: "Outros cartões", rows: [], cards: leftover, total: 0, outsideOverall: false });
  }
  return result;
}

/* ───────── By type ───────── */

export const GROUP_ORDER: AccountGroup[] = ["AVAILABLE", "SAVED", "INVESTMENTS", "BENEFITS"];
export const GROUP_LABEL: Record<AccountGroup, string> = {
  AVAILABLE: "Contas",
  SAVED: "Cofrinhos",
  INVESTMENTS: "Investimentos",
  BENEFITS: "Benefícios",
};

export function groupByType(accounts: readonly Account[], showArchived: boolean) {
  return GROUP_ORDER.map((group) => {
    const items = accounts.filter((a) => a.group === group && (showArchived || a.active));
    return { group, items, total: round2(items.filter((a) => a.active).reduce((s, a) => s + a.balance, 0)) };
  }).filter((s) => s.items.length > 0);
}

export function findAccount(accounts: readonly Account[], id: Id | null | undefined): Account | undefined {
  return id == null ? undefined : accounts.find((a) => a.id === id);
}
