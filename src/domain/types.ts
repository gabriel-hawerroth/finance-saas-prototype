/**
 * Domain model for Finax. Shapes mirror the API contract described in the
 * functional spec (§3, §8) so the mock layer can be swapped for a real client.
 * Dates travel as civil ISO strings: `yyyy-MM-dd` (dates), `HH:mm` (times),
 * full ISO for audit timestamps.
 */

export type ISODate = string;
export type ISODateTime = string;
export type Id = number;

/* ───────────── User & preferences ───────────── */

export type AccessLevel = "BASIC" | "PREMIUM" | "ADM";
export type SubscriptionPlan = "MONTHLY" | "YEARLY";
export type AuthProvider = "LOCAL" | "GOOGLE";

export interface User {
  id: Id;
  email: string;
  firstName: string;
  lastName?: string | null;
  access: AccessLevel;
  active: boolean;
  subscriptionPlan: SubscriptionPlan;
  provider: AuthProvider;
}

export type Theme = "light" | "dark" | "system";
export type Language = "pt-BR" | "en-US" | "es-CO" | "de-DE";
export type CurrencySymbol = "R$" | "$" | "€" | "£" | "¥";

export interface UserConfigs {
  theme: Theme;
  language: Language;
  currency: CurrencySymbol;
  showAuditFields: boolean;
}

export interface Audit {
  createdAt: ISODateTime;
  updatedAt?: ISODateTime | null;
}

/* ───────────── Institutions & accounts ───────────── */

export type InstitutionCategory = "BANK" | "BROKERAGE" | "BENEFIT" | "WALLET";

export interface Institution {
  id: Id;
  name: string;
  code?: string | null;
  category: InstitutionCategory;
  /** Brand colour used to draw the monogram logo. */
  color: string;
  /** Short monogram shown in place of a logo image. */
  mark: string;
}

export type AccountType = "CHECKING" | "SAVING" | "BROKERAGE" | "BENEFIT" | "CASH";
export type AccountGroup = "AVAILABLE" | "SAVED" | "INVESTMENTS" | "BENEFITS";
export type PiggyPurpose = "SAVINGS" | "INVESTMENT";

export interface Account extends Audit {
  id: Id;
  name?: string | null;
  /** Server-resolved display name (name or institution). */
  displayName: string;
  balance: number;
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
  group: AccountGroup;
  canHoldPiggyBanks: boolean;
  canBecomePiggyBank: boolean;
}

export interface AccountsOverallBalance {
  overallBalance: number;
  availableBalance: number;
  savedBalance: number;
  investmentsBalance: number;
  benefitsOutsideBalance: number;
  totalBalance: number;
}

export interface AccountTypeDefaults {
  type: AccountType;
  countsForOverallBalance: boolean;
  visibleInCashFlow: boolean;
}

export interface BasicAccount {
  id: Id;
  name: string;
  institutionId?: Id | null;
  balance: number;
  type?: AccountType | null;
  primaryAccountId?: Id | null;
}

export interface SaveAccountDTO {
  name?: string | null;
  balance?: number;
  countsForOverallBalance: boolean;
  visibleInCashFlow: boolean;
  institutionId?: Id | null;
  institutionName?: string | null;
  accountNumber?: string | null;
  agency?: string | null;
  type?: AccountType | null;
  primaryAccountId?: Id | null;
  purpose?: PiggyPurpose | null;
  goal?: number | null;
  initialAmount?: number | null;
}

export type BalanceDirection = "UP" | "DOWN" | "NONE";
export interface BalanceDifference {
  currentBalance: number;
  amount: number;
  direction: BalanceDirection;
}

export interface RedeemInvestmentDTO {
  fromAccountId: Id;
  toAccountId: Id;
  redeemedAmount: number;
  receivedAmount: number;
  taxCategoryId?: Id | null;
  transferDescription?: string;
  taxDescription?: string;
}

/* ───────────── Categories ───────────── */

export type CategoryType = "E" | "R";

export interface Category extends Audit {
  id: Id;
  name: string;
  color: string;
  icon: string;
  type: CategoryType;
  essential: boolean;
  active: boolean;
}

export interface Subcategory extends Audit {
  id: Id;
  name: string;
  essential: boolean;
  active: boolean;
  categoryId: Id;
}

export interface CategoryWithSubs extends Category {
  subcategories: Subcategory[];
}

/* ───────────── Credit cards & invoices ───────────── */

export type CardInvoiceState = "OPEN" | "CLOSED" | "PAID";

export interface CardInvoiceSummary {
  state: CardInvoiceState;
  referenceMonth: string; // MM/yyyy
  closeDate: ISODate;
  dueDate: ISODate;
  amount: number;
  outstanding: number;
  currentInvoiceAmount: number;
  availableLimit: number;
}

export interface CreditCard extends Audit {
  id: Id;
  name?: string | null;
  displayName: string;
  cardLimit: number;
  closeDay: number;
  invoiceDueDay: number;
  institutionId?: Id | null;
  standardPaymentAccountId: Id;
  active: boolean;
  accountName?: string | null;
  invoiceSummary: CardInvoiceSummary;
}

export interface SaveCardDTO {
  name?: string | null;
  cardLimit: number;
  closeDay: number;
  invoiceDueDay: number;
  institutionId?: Id | null;
  standardPaymentAccountId: Id;
}

export type InvoiceStatus = "FUTURE" | "OPEN" | "CLOSED";

export interface InvoiceOption {
  invoiceId: Id | null;
  referenceMonth: string;
  sharesReferenceMonth: boolean;
  firstDay: ISODate;
  closeDay: ISODate;
  dueDate: ISODate;
  status: InvoiceStatus;
  settled: boolean;
  amount: number;
  outstanding: number;
}

export interface InvoiceComposition {
  previousBalance: number;
  purchases: number;
  installments: number;
}

export interface InvoicePayment {
  id: Id;
  creditCardId: Id;
  monthYear: string;
  paymentAccountId: Id;
  paymentAccountName: string;
  paymentAccountInstitutionId?: Id | null;
  paymentAmount: number;
  paymentDate: ISODate;
  paymentHour?: string | null;
  attachmentName?: string | null;
}

export interface InvoiceCycleValues extends InvoiceOption {
  composition: InvoiceComposition;
  releases: MonthlyRelease[];
  payments: InvoicePayment[];
  settledByDueDate: ISODate | null;
  canPay: boolean;
  canEditDates: boolean;
  closeDayPinned: boolean;
  dueDatePinned: boolean;
  previousCloseDate: ISODate;
  nextCloseDate: ISODate;
}

export interface CycleSimulationInvoice {
  referenceMonth: string;
  firstDay: ISODate;
  closeDay: ISODate;
  dueDate: ISODate;
  days: number;
  transition: boolean;
  outsideCycleWindow?: boolean;
}

export interface InvoiceCycleChange {
  movesReleases: boolean;
  releasesChangingInvoice: number;
  totalInvoices: number;
  invoices: CycleSimulationInvoice[];
}

export interface SaveInvoicePaymentDTO {
  creditCardId: Id;
  closeDate: ISODate;
  paymentAccountId: Id;
  paymentAmount: number;
  paymentDate: ISODate;
  paymentHour?: string | null;
}

/* ───────────── Releases (cash flow) ───────────── */

export type ReleaseType = "E" | "R" | "T";
export type ReleaseKind = "RELEASE" | "INVOICE_PAYMENT";
export type RepeatMode = "FIXED" | "INSTALLMENTS";
export type FixedBy = "DAILY" | "WEEKLY" | "MONTHLY" | "BIMONTHLY" | "QUARTERLY" | "BIANNUAL" | "ANNUAL";
export type SeriesScope = "JUST_THIS" | "NEXTS" | "ALL" | "UNNECESSARY";
export type InvoiceResolution = "KEEP" | "MOVE_TO_OPEN";

export interface RefName {
  id: Id;
  name: string;
  active: boolean;
  institutionId?: Id | null;
}

export interface ReimbursementRef {
  id: Id;
  amount: number;
  date: ISODate;
  done: boolean;
}

export interface Attachment {
  name: string;
  size: number;
  type: string;
  dataUrl: string;
}

export interface MonthlyRelease extends Audit {
  key: string; // kind + id
  id: Id;
  kind: ReleaseKind;
  type: ReleaseType;
  description?: string | null;
  amount: number;
  account?: RefName | null;
  card?: RefName | null;
  targetAccount?: RefName | null;
  category?: (RefName & { color: string; icon: string; type: CategoryType }) | null;
  subcategory?: RefName | null;
  date: ISODate;
  time?: string | null;
  purchaseDate?: ISODate | null;
  done: boolean;
  observation?: string | null;
  attachmentName?: string | null;
  seriesId?: string | null;
  isDuplicatedRelease: boolean;
  repeat?: RepeatMode | null;
  installmentNumber?: number | null;
  totalInstallments?: number | null;
  balanceAdjustment: boolean;
  countsInCashFlow: boolean;
  countsInMonthTotals: boolean;
  invoiceId?: Id | null;
  invoicePinned: boolean;
  invoiceMonthYear?: string | null;
  invoiceCloseDay?: ISODate | null;
  sharesReferenceMonth?: boolean;
  reimbursedReleaseId?: Id | null;
  reimbursedRelease?: { id: Id; description: string; amount: number; categoryName?: string | null } | null;
  reimbursements: ReimbursementRef[];
  reimbursedAmount: number;
  netAmount: number;
  reimbursableAmount: number;
  canRegisterReimbursement: boolean;
}

export interface SaveReleaseDTO {
  description?: string | null;
  accountId?: Id | null;
  creditCardId?: Id | null;
  targetAccountId?: Id | null;
  amount: number;
  type: ReleaseType;
  done: boolean;
  categoryId?: Id | null;
  subcategoryId?: Id | null;
  date: ISODate;
  purchaseDate?: ISODate | null;
  time?: string | null;
  observation?: string | null;
  repeat?: RepeatMode | null;
  fixedBy?: FixedBy | null;
  countsInCashFlow: boolean;
  reimbursedReleaseId?: Id | null;
}

/** Attachment change requested together with a release save. */
export type AttachmentChange = { kind: "keep" } | { kind: "remove" } | { kind: "set"; file: Attachment };

export interface PaidInvoiceConflictInvoice {
  label: string;
  firstDay: ISODate;
  closeDay: ISODate;
  dueDate: ISODate;
  lastPaymentDate: ISODate | null;
  settledByLater: boolean;
  paidAmount: number;
  outstandingAfter: number;
  entering: boolean;
}

export interface PaidInvoiceConflictDetails {
  invoices: PaidInvoiceConflictInvoice[];
  affectedInvoices: number;
  canMove: boolean;
  target: { label: string } | null;
  releaseDate: ISODate;
}

export interface InvoiceHasPaymentDetails {
  thisInvoice: boolean;
  nextInvoice: boolean;
  nextReferenceMonth?: string;
}

/* ───────────── Home & reports ───────────── */

export interface HomeInstitution {
  key: string;
  name: string;
  institutionId?: Id | null;
  balance: number;
}

export interface HomeUpcomingRelease {
  id: Id;
  type: "E" | "R";
  categoryColor: string;
  categoryIcon: string;
  categoryName: string;
  subcategoryName?: string | null;
  isCreditCardRelease: boolean;
  description?: string | null;
  sourceName: string;
  date: ISODate;
  amount: number;
  active: boolean;
}

export interface SpendByCategory {
  categoryId: Id;
  categoryName: string;
  color: string;
  icon: string;
  percent: number;
  value: number;
}

export type HomeInterval = "LAST_30_DAYS" | "CURRENT_MONTH";

export interface EssentialExpenses {
  essentialValue: number;
  notEssentialValue: number;
  essentialPercent: number;
  notEssentialPercent: number;
  startDate: ISODate;
  endDate: ISODate;
}

export interface HomeCreditCard {
  cardId: Id;
  cardName: string;
  institutionId?: Id | null;
  invoiceSummary: CardInvoiceSummary;
}

export type ReportInterval = "LAST_30_DAYS" | "LAST_12_MONTHS" | "MONTHLY" | "YEARLY" | "CUSTOM";

export interface ReportPeriod {
  interval: ReportInterval;
  initialDate?: ISODate;
  finalDate?: ISODate;
}

export interface ReleasesByCategoryItem {
  category: { id: Id; name: string; color: string; icon: string };
  percent: number;
  value: number;
}

export interface ReleasesBySubcategoryItem {
  subcategoryName: string;
  percent: number;
  value: number;
}

export interface ReleasesByAccountItem {
  accountName: string;
  percent: number;
  value: number;
}

export type BalanceGrouper = "DAILY" | "WEEKLY" | "MONTHLY" | "BY_RELEASE";

export interface BalanceEvolutionPoint {
  date: ISODate;
  amount: number;
}
