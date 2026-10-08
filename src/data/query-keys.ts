import type { BalanceGrouper, HomeInterval, Id, ISODate, ReportPeriod } from "@/domain/types";

/** Central query-key catalogue. The first segment groups keys for invalidation. */
export const qk = {
  institutions: ["institutions"] as const,
  configs: ["configs"] as const,
  profileImage: ["profile-image"] as const,
  inbox: ["inbox"] as const,
  accounts: ["fin", "accounts"] as const,
  account: (id: Id) => ["fin", "account", id] as const,
  basicAccounts: (sub: boolean) => ["fin", "basic-accounts", sub] as const,
  overall: ["fin", "overall"] as const,
  typeDefaults: ["type-defaults"] as const,
  categories: ["fin", "categories"] as const,
  subcategories: (id: Id) => ["fin", "subcategories", id] as const,
  cards: ["fin", "cards"] as const,
  card: (id: Id) => ["fin", "card", id] as const,
  invoices: (cardId: Id) => ["fin", "invoices", cardId] as const,
  cycle: (cardId: Id, closeDate: ISODate) => ["fin", "cycle", cardId, closeDate] as const,
  monthly: (monthKey: string) => ["fin", "monthly", monthKey] as const,
  home: {
    revenueExpense: ["fin", "home", "revenue-expense"] as const,
    accounts: ["fin", "home", "accounts"] as const,
    upcoming: ["fin", "home", "upcoming"] as const,
    spends: (i: HomeInterval) => ["fin", "home", "spends", i] as const,
    essential: (i: HomeInterval) => ["fin", "home", "essential", i] as const,
    cards: ["fin", "home", "cards"] as const,
  },
  reports: {
    byCategory: (p: ReportPeriod) => ["fin", "reports", "category", p] as const,
    bySub: (id: Id, p: ReportPeriod) => ["fin", "reports", "sub", id, p] as const,
    byAccount: (p: ReportPeriod) => ["fin", "reports", "account", p] as const,
    balance: (p: ReportPeriod, g: BalanceGrouper, acc: Id | null) => ["fin", "reports", "balance", p, g, acc] as const,
  },
};
