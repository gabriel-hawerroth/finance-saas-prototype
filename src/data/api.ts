/**
 * Data-access layer used by the whole UI. It mirrors the REST contract of the spec
 * (§8) but is backed by the in-browser mock server. Swapping this module for an
 * HTTP client is the only change needed to talk to a real backend.
 *
 * Every call simulates network latency and can simulate failures (configured in
 * the "Laboratório" section of Settings) so loading/error states are demonstrable.
 */
import { ApiError } from "@/domain/errors";
import type {
  AccountsOverallBalance,
  Attachment,
  BalanceGrouper,
  Id,
  ISODate,
  InvoiceResolution,
  ReportPeriod,
  SaveAccountDTO,
  SaveCardDTO,
  SaveInvoicePaymentDTO,
  SaveReleaseDTO,
  SeriesScope,
  RedeemInvestmentDTO,
  UserConfigs,
  HomeInterval,
} from "@/domain/types";
import { sleep } from "@/lib/utils";
import { emitApiEvent } from "./api-events";
import { useNetworkLab } from "./network-lab";
import * as accounts from "./server/accounts";
import * as auth from "./server/auth";
import * as cards from "./server/cards";
import * as categories from "./server/categories";
import { getDB, read, resetDB, write } from "./server/db";
import * as home from "./server/home";
import { INSTITUTIONS } from "./server/institutions";
import * as releases from "./server/releases";
import * as reports from "./server/reports";

async function call<T>(fn: () => T, { silent = false }: { silent?: boolean } = {}): Promise<T> {
  const lab = useNetworkLab.getState();
  const base = lab.latency === "instant" ? 0 : lab.latency === "slow" ? 1400 : 220;
  await sleep(base + (base ? Math.random() * base * 0.8 : 0));
  try {
    if (lab.offline) throw new ApiError(0, { errorDescription: "network" });
    if (!silent && lab.failureRate > 0 && Math.random() < lab.failureRate) throw new ApiError(500, { errorDescription: "simulated failure" });
    getDB();
    const result = fn();
    return result === undefined ? result : structuredClone(result);
  } catch (error) {
    if (error instanceof ApiError) emitApiEvent(error);
    throw error;
  }
}

export const api = {
  institutions: {
    list: () => call(() => INSTITUTIONS, { silent: true }),
  },

  auth: {
    login: (email: string, password: string) => call(() => auth.login(email, password), { silent: true }),
    google: (email: string, name: string) => call(() => auth.googleLogin(email, name), { silent: true }),
    register: (dto: Parameters<typeof auth.register>[0]) => call(() => auth.register(dto), { silent: true }),
    resendActivation: (email: string) => call(() => auth.resendActivation(email), { silent: true }),
    activate: (token: string) => call(() => auth.activate(token), { silent: true }),
    logout: () => call(() => auth.logout(), { silent: true }),
    requestRecovery: (email: string) => call(() => auth.requestPasswordRecovery(email), { silent: true }),
    validateRecovery: (token: string) => call(() => auth.validateRecoveryToken(token), { silent: true }),
    confirmRecovery: (token: string, newPassword: string) => call(() => auth.confirmPasswordRecovery(token, newPassword), { silent: true }),
    sendCancelEmail: () => call(() => auth.sendCancelAccountEmail()),
    cancelUser: (token: string) => call(() => auth.cancelUser(token), { silent: true }),
    inbox: () => call(() => auth.inbox(), { silent: true }),
    markEmailRead: (id: string) => call(() => auth.markEmailRead(id), { silent: true }),
  },

  user: {
    me: () => call(() => auth.me(), { silent: true }),
    update: (dto: { firstName: string; lastName?: string | null }) => call(() => auth.updateUser(dto)),
    changePassword: (currentPassword: string, newPassword: string) => call(() => auth.changePassword(currentPassword, newPassword)),
    setProfileImage: (dataUrl: string | null) => call(() => auth.setProfileImage(dataUrl)),
    profileImage: () => call(() => auth.profileImage(), { silent: true }),
    configs: () => call(() => auth.getConfigs(), { silent: true }),
    saveConfigs: (c: UserConfigs) => call(() => auth.saveConfigs(c)),
  },

  accounts: {
    list: () => call(() => read((ds) => accounts.listAccounts(ds))),
    get: (id: Id) => call(() => read((ds) => accounts.getAccount(ds, id))),
    basicList: (showSubAccounts: boolean) => call(() => read((ds) => accounts.basicList(ds, showSubAccounts))),
    overallBalance: (): Promise<AccountsOverallBalance> => call(() => read((ds) => accounts.overallBalance(ds))),
    typeDefaults: () => call(() => accounts.TYPE_DEFAULTS),
    create: (dto: SaveAccountDTO) => call(() => write((ds) => accounts.createAccount(ds, dto))),
    update: (id: Id, dto: SaveAccountDTO) => call(() => write((ds) => accounts.updateAccount(ds, id, dto))),
    adjustBalance: (id: Id, newBalance: number) => call(() => write((ds) => accounts.adjustBalance(ds, id, newBalance))),
    balanceDifference: (id: Id, informed: number) => call(() => read((ds) => accounts.balanceDifference(ds, id, informed)), { silent: true }),
    redeem: (dto: RedeemInvestmentDTO) => call(() => write((ds) => accounts.redeem(ds, dto))),
    remove: (id: Id) => call(() => write((ds) => accounts.deleteAccount(ds, id))),
    inactivate: (id: Id) => call(() => write((ds) => accounts.inactivateAccount(ds, id))),
    activate: (id: Id, subAccounts: Id[]) => call(() => write((ds) => accounts.activateAccount(ds, id, subAccounts))),
  },

  categories: {
    listWithSubs: () => call(() => read((ds) => categories.listCategoriesWithSubs(ds))),
    list: () => call(() => read((ds) => categories.listCategories(ds))),
    subcategories: (categoryId: Id) => call(() => read((ds) => categories.subcategoriesOf(ds, categoryId))),
    create: (dto: categories.SaveCategoryDTO) => call(() => write((ds) => categories.createCategory(ds, dto))),
    update: (id: Id, dto: categories.SaveCategoryDTO) => call(() => write((ds) => categories.updateCategory(ds, id, dto))),
    remove: (id: Id) => call(() => write((ds) => categories.deleteCategory(ds, id))),
    inactivate: (id: Id) => call(() => write((ds) => categories.inactivateCategory(ds, id))),
    createSub: (dto: { name: string; essential: boolean; categoryId: Id }) => call(() => write((ds) => categories.createSubcategory(ds, dto))),
    updateSub: (id: Id, dto: { name: string; essential: boolean }) => call(() => write((ds) => categories.updateSubcategory(ds, id, dto))),
    removeSub: (id: Id) => call(() => write((ds) => categories.deleteSubcategory(ds, id))),
    inactivateSub: (id: Id) => call(() => write((ds) => categories.inactivateSubcategory(ds, id))),
    moveReleases: (dto: categories.MoveReleasesDTO) => call(() => write((ds) => categories.moveReleases(ds, dto))),
  },

  cards: {
    list: () => call(() => read((ds) => cards.listCards(ds))),
    get: (id: Id) => call(() => read((ds) => cards.getCard(ds, id))),
    byInstitution: () => call(() => read((ds) => cards.cardsByInstitution(ds))),
    create: (dto: SaveCardDTO) => call(() => write((ds) => cards.createCard(ds, dto))),
    update: (id: Id, dto: SaveCardDTO) => call(() => write((ds) => cards.updateCard(ds, id, dto))),
    simulateCycleChange: (id: Id, closeDay: number, invoiceDueDay: number) => call(() => read((ds) => cards.simulateCycleChange(ds, id, closeDay, invoiceDueDay))),
    remove: (id: Id) => call(() => write((ds) => cards.deleteCard(ds, id))),
    setActive: (id: Id, active: boolean) => call(() => write((ds) => cards.setCardActive(ds, id, active))),
  },

  invoices: {
    byCard: (cardId: Id) => call(() => write((ds) => cards.invoicesByCard(ds, cardId))),
    cycleValues: (cardId: Id, closeDate: ISODate) => call(() => write((ds) => cards.cycleValues(ds, cardId, closeDate))),
    addPayment: (dto: SaveInvoicePaymentDTO) => call(() => write((ds) => cards.addPayment(ds, dto))),
    editPayment: (id: Id, dto: Omit<SaveInvoicePaymentDTO, "creditCardId" | "closeDate">) => call(() => write((ds) => cards.editPayment(ds, id, dto))),
    deletePayment: (id: Id) => call(() => write((ds) => cards.deletePayment(ds, id))),
    setPaymentAttachment: (id: Id, file: Attachment | null) => call(() => write((ds) => cards.setPaymentAttachment(ds, id, file))),
    paymentAttachment: (id: Id) => call(() => read((ds) => cards.getPaymentAttachment(ds, id))),
    simulateDateChange: (invoiceId: Id, change: { closeDay?: ISODate | null; dueDate?: ISODate | null }) =>
      call(() => write((ds) => cards.simulateDateChange(ds, invoiceId, change))),
    updateDates: (invoiceId: Id, change: { closeDay?: ISODate | null; dueDate?: ISODate | null }, confirmed = false) =>
      call(() => write((ds) => cards.updateInvoiceDates(ds, invoiceId, change, confirmed))),
  },

  releases: {
    monthly: (monthKey: string) => call(() => read((ds) => releases.getMonthlyReleases(ds, monthKey))),
    get: (id: Id) => call(() => read((ds) => releases.getRelease(ds, id))),
    create: (dto: SaveReleaseDTO, repeatFor: number, resolution?: InvoiceResolution) => call(() => write((ds) => releases.createRelease(ds, dto, repeatFor, resolution))),
    update: (id: Id, dto: SaveReleaseDTO, scope: SeriesScope, resolution?: InvoiceResolution) => call(() => write((ds) => releases.updateRelease(ds, id, dto, scope, resolution))),
    remove: (id: Id, scope: SeriesScope, resolution?: InvoiceResolution) => call(() => write((ds) => releases.deleteRelease(ds, id, scope, resolution))),
    updateDone: (id: Id, done: boolean, resolution?: InvoiceResolution) => call(() => write((ds) => releases.updateDone(ds, id, done, resolution))),
    updateInvoice: (id: Id, target: { invoiceId?: Id | null; closeDate?: ISODate | null } | null, resolution?: InvoiceResolution) =>
      call(() => write((ds) => releases.updateReleaseInvoice(ds, id, target, resolution))),
    setAttachment: (id: Id, file: Attachment | null) => call(() => write((ds) => releases.setReleaseAttachment(ds, id, file))),
    attachment: (id: Id) => call(() => read((ds) => releases.getAttachment(ds, id))),
  },

  home: {
    revenueExpense: () => call(() => read((ds) => home.revenueExpense(ds))),
    accounts: () => call(() => read((ds) => home.accountsList(ds))),
    upcoming: () => call(() => read((ds) => home.upcomingReleases(ds))),
    spendsByCategory: (interval: HomeInterval) => call(() => read((ds) => home.spendsByCategory(ds, interval))),
    essentialExpenses: (interval: HomeInterval) => call(() => read((ds) => home.essentialExpenses(ds, interval))),
    creditCards: () => call(() => read((ds) => home.creditCardsList(ds))),
  },

  reports: {
    byCategory: (p: ReportPeriod) => call(() => read((ds) => reports.byCategory(ds, p))),
    bySubcategory: (categoryId: Id, p: ReportPeriod) => call(() => read((ds) => reports.bySubcategory(ds, categoryId, p))),
    byAccount: (p: ReportPeriod) => call(() => read((ds) => reports.byAccount(ds, p))),
    balanceEvolution: (p: ReportPeriod, grouper: BalanceGrouper, accountId?: Id | null) => call(() => read((ds) => reports.balanceEvolution(ds, p, grouper, accountId))),
  },

  demo: {
    reset: () => call(() => resetDB(), { silent: true }),
  },
};

export type Api = typeof api;
