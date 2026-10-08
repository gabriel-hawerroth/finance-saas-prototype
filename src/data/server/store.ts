/**
 * Persistent state of the mock backend. Everything the "server" knows lives here,
 * serialised to localStorage so the demo survives reloads. Each user has an
 * isolated dataset: the demo user starts with rich history, newly registered
 * users start empty (to exercise onboarding).
 */
import type {
  AccountType,
  AccessLevel,
  Attachment,
  AuthProvider,
  CategoryType,
  FixedBy,
  Id,
  ISODate,
  ISODateTime,
  PiggyPurpose,
  ReleaseType,
  RepeatMode,
  SubscriptionPlan,
  UserConfigs,
} from "@/domain/types";

export interface StoredUser {
  id: Id;
  email: string;
  password: string;
  firstName: string;
  lastName?: string | null;
  access: AccessLevel;
  active: boolean;
  subscriptionPlan: SubscriptionPlan;
  provider: AuthProvider;
  profileImage: string | null;
  configs: UserConfigs;
}

export interface StoredAccount {
  id: Id;
  name?: string | null;
  type?: AccountType | null;
  institutionId?: Id | null;
  institutionName?: string | null;
  accountNumber?: string | null;
  agency?: string | null;
  countsForOverallBalance: boolean;
  visibleInCashFlow: boolean;
  active: boolean;
  primaryAccountId?: Id | null;
  purpose?: PiggyPurpose | null;
  goal?: number | null;
  initialBalance: number;
  createdAt: ISODateTime;
  updatedAt?: ISODateTime | null;
}

export interface StoredCategory {
  id: Id;
  name: string;
  color: string;
  icon: string;
  type: CategoryType;
  essential: boolean;
  active: boolean;
  createdAt: ISODateTime;
  updatedAt?: ISODateTime | null;
}

export interface StoredSubcategory {
  id: Id;
  name: string;
  essential: boolean;
  active: boolean;
  categoryId: Id;
  createdAt: ISODateTime;
  updatedAt?: ISODateTime | null;
}

export interface StoredCard {
  id: Id;
  name?: string | null;
  cardLimit: number;
  closeDay: number;
  invoiceDueDay: number;
  institutionId?: Id | null;
  standardPaymentAccountId: Id;
  active: boolean;
  createdAt: ISODateTime;
  updatedAt?: ISODateTime | null;
}

/** Materialised invoice row. `key` is the natural close month (yyyy-MM) that identifies the cycle. */
export interface StoredInvoice {
  id: Id;
  creditCardId: Id;
  key: string;
  closeDate?: ISODate | null;
  dueDate?: ISODate | null;
  closeDayPinned: boolean;
  dueDatePinned: boolean;
}

export interface StoredPayment {
  id: Id;
  creditCardId: Id;
  invoiceId: Id;
  accountId: Id;
  amount: number;
  date: ISODate;
  hour?: string | null;
  attachment?: Attachment | null;
  createdAt: ISODateTime;
}

export interface StoredRelease {
  id: Id;
  type: ReleaseType;
  description?: string | null;
  amount: number;
  accountId?: Id | null;
  creditCardId?: Id | null;
  targetAccountId?: Id | null;
  categoryId?: Id | null;
  subcategoryId?: Id | null;
  date: ISODate;
  time?: string | null;
  purchaseDate?: ISODate | null;
  done: boolean;
  observation?: string | null;
  attachment?: Attachment | null;
  seriesId?: string | null;
  repeat?: RepeatMode | null;
  fixedBy?: FixedBy | null;
  installmentNumber?: number | null;
  totalInstallments?: number | null;
  balanceAdjustment: boolean;
  countsInCashFlow: boolean;
  /** Invoice cycle key the release was pinned to by hand (null = follows its date). */
  pinnedInvoiceKey?: string | null;
  reimbursedReleaseId?: Id | null;
  createdAt: ISODateTime;
  updatedAt?: ISODateTime | null;
}

export interface Dataset {
  accounts: StoredAccount[];
  categories: StoredCategory[];
  subcategories: StoredSubcategory[];
  cards: StoredCard[];
  invoices: StoredInvoice[];
  payments: StoredPayment[];
  releases: StoredRelease[];
  seq: number;
}

export type TokenKind = "ACTIVATION" | "RECOVERY" | "CANCEL";
export interface StoredToken {
  token: string;
  kind: TokenKind;
  userId: Id;
  expiresAt: number;
  used: boolean;
}

export interface SimulatedEmail {
  id: string;
  to: string;
  subject: string;
  body: string;
  link: string;
  linkLabel: string;
  sentAt: number;
  read: boolean;
}

export interface DB {
  version: number;
  users: StoredUser[];
  datasets: Record<string, Dataset>;
  tokens: StoredToken[];
  inbox: SimulatedEmail[];
  userSeq: number;
}

export const DB_VERSION = 3;
export const DB_KEY = "finax.db";
export const SESSION_KEY = "finax.session";

export function emptyDataset(): Dataset {
  return { accounts: [], categories: [], subcategories: [], cards: [], invoices: [], payments: [], releases: [], seq: 1 };
}

export function nextId(ds: Dataset): Id {
  ds.seq += 1;
  return ds.seq;
}

export function nowISO(): ISODateTime {
  return new Date().toISOString();
}
