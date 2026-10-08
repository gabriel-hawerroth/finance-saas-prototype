/**
 * Deterministic, date-relative demo data. Generated around "today" so that the
 * demo always shows a current month, past history and future forecasts:
 * ~12 months of history and 6 months ahead, recurring series, installment
 * purchases, piggy banks, investments, benefits, reimbursements, a balance
 * adjustment, an out-of-cash-flow expense and paid card invoices.
 */
import { addMonthsISO, addDaysISO, daysInMonth, monthKeyOf, shiftMonthKey, todayISO, toISODate } from "@/lib/dates";
import { round2 } from "@/lib/utils";
import type { CategoryType, FixedBy, Id, ISODate, ReleaseType } from "@/domain/types";
import { buildCycles, ensureRows } from "./invoice-engine";
import { computeBalances } from "./ledger";
import { emptyDataset, nextId, type Dataset, type StoredRelease, type StoredUser } from "./store";

export const DEMO_EMAIL = "demo@finax.app";
export const DEMO_PASSWORD = "Finax@2026";

export const DEMO_USER: StoredUser = {
  id: 1,
  email: DEMO_EMAIL,
  password: DEMO_PASSWORD,
  firstName: "Marina",
  lastName: "Duarte",
  access: "PREMIUM",
  active: true,
  subscriptionPlan: "YEARLY",
  provider: "LOCAL",
  profileImage: null,
  configs: { theme: "system", language: "pt-BR", currency: "R$", showAuditFields: true },
};

/* ───── default categories (also given to new users) ───── */

interface CatSeed {
  name: string;
  color: string;
  icon: string;
  essential: boolean;
  subs?: [string, boolean][];
}

const EXPENSE_CATEGORIES: CatSeed[] = [
  { name: "Alimentação", color: "#f76b15", icon: "Utensils", essential: true, subs: [["Mercado", true], ["Restaurantes", false], ["Delivery", false], ["Padaria", true]] },
  { name: "Moradia", color: "#3e63dd", icon: "House", essential: true, subs: [["Aluguel", true], ["Condomínio", true], ["Energia", true], ["Água", true], ["Internet", true], ["IPTU", true]] },
  { name: "Transporte", color: "#0894b3", icon: "Car", essential: true, subs: [["Combustível", true], ["App de transporte", false], ["Transporte público", true], ["Manutenção", true], ["Seguro", true]] },
  { name: "Saúde", color: "#30a46c", icon: "HeartPulse", essential: true, subs: [["Plano de saúde", true], ["Farmácia", true], ["Consultas", true]] },
  { name: "Educação", color: "#6e56cf", icon: "GraduationCap", essential: true, subs: [["Cursos", true], ["Livros", false]] },
  { name: "Lazer", color: "#d6409f", icon: "PartyPopper", essential: false, subs: [["Streaming", false], ["Cinema e shows", false], ["Viagens", false], ["Bares", false]] },
  { name: "Compras", color: "#e2a336", icon: "ShoppingBag", essential: false, subs: [["Roupas", false], ["Eletrônicos", false], ["Casa e decoração", false]] },
  { name: "Bem-estar", color: "#12a594", icon: "Dumbbell", essential: false, subs: [["Academia", false], ["Cuidados pessoais", false]] },
  { name: "Pets", color: "#b5a33a", icon: "Dog", essential: true, subs: [["Ração", true], ["Veterinário", true]] },
  { name: "Impostos e taxas", color: "#687076", icon: "Landmark", essential: true, subs: [["IPVA", true], ["IOF", true], ["Tarifas bancárias", true]] },
  { name: "Presentes", color: "#e5484d", icon: "Gift", essential: false },
  { name: "Desvalorização", color: "#8d7f6c", icon: "ChartLine", essential: false },
  { name: "Outras Despesas", color: "#8d7f6c", icon: "Ellipsis", essential: false },
];

const REVENUE_CATEGORIES: CatSeed[] = [
  { name: "Salário", color: "#30a46c", icon: "Briefcase", essential: false, subs: [["13º salário", false], ["Bônus", false]] },
  { name: "Freelance", color: "#0d74ce", icon: "Laptop", essential: false },
  { name: "Rendimentos", color: "#7cb342", icon: "TrendingUp", essential: false },
  { name: "Valorização", color: "#12a594", icon: "ChartLine", essential: false },
  { name: "Benefícios", color: "#e2a336", icon: "HandCoins", essential: false },
  { name: "Vendas", color: "#f76b15", icon: "Store", essential: false },
  { name: "Outras Receitas", color: "#8d7f6c", icon: "Ellipsis", essential: false },
];

type CatIndex = Map<string, { id: Id; subs: Map<string, Id> }>;

function addCategories(ds: Dataset, createdAt: string): CatIndex {
  const index: CatIndex = new Map();
  const add = (list: CatSeed[], type: CategoryType) => {
    for (const c of list) {
      const id = nextId(ds);
      ds.categories.push({ id, name: c.name, color: c.color, icon: c.icon, type, essential: type === "E" && c.essential, active: true, createdAt });
      const subs = new Map<string, Id>();
      for (const [name, essential] of c.subs ?? []) {
        const sid = nextId(ds);
        ds.subcategories.push({ id: sid, name, essential: type === "E" && essential, active: true, categoryId: id, createdAt });
        subs.set(name, sid);
      }
      index.set(c.name, { id, subs });
    }
  };
  add(EXPENSE_CATEGORIES, "E");
  add(REVENUE_CATEGORIES, "R");
  return index;
}

export function buildStarterDataset(): Dataset {
  const ds = emptyDataset();
  addCategories(ds, new Date().toISOString());
  return ds;
}

/* ───── demo dataset ───── */

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dayOf(monthKey: string, day: number): ISODate {
  const [y, m] = monthKey.split("-").map(Number);
  return toISODate(new Date(y, m - 1, Math.min(day, daysInMonth(y, m - 1)), 12));
}

export function buildDemoDataset(): Dataset {
  const ds = emptyDataset();
  ds.seq = 1000;
  const today = todayISO();
  const thisMonth = monthKeyOf(today);
  const startMonth = shiftMonthKey(thisMonth, -12);
  const created = `${addMonthsISO(`${startMonth}-01`, -1)}T10:00:00.000Z`;
  const rng = mulberry32(20261008);
  const between = (a: number, b: number) => round2(a + rng() * (b - a));
  const cats = addCategories(ds, created);
  const cat = (name: string, sub?: string) => {
    const c = cats.get(name)!;
    return { categoryId: c.id, subcategoryId: sub ? c.subs.get(sub) ?? null : null };
  };

  /* accounts */
  const acc = (p: Partial<Dataset["accounts"][number]> & { id?: Id }) => {
    const id = nextId(ds);
    ds.accounts.push({
      id,
      name: null,
      type: "CHECKING",
      countsForOverallBalance: true,
      visibleInCashFlow: true,
      active: true,
      initialBalance: 0,
      createdAt: created,
      ...p,
    });
    return id;
  };
  const itau = acc({ institutionId: 3, agency: "0472", accountNumber: "38211-6" });
  const nubank = acc({ institutionId: 2, accountNumber: "9012345-1" });
  const reserva = acc({ name: "Reserva de emergência", primaryAccountId: nubank, purpose: "SAVINGS", goal: 30000 });
  const viagem = acc({ name: "Viagem ao Japão", primaryAccountId: nubank, purpose: "SAVINGS", goal: 18000 });
  const ipva = acc({ name: "IPVA 2027", primaryAccountId: itau, purpose: "INVESTMENT", goal: 3200 });
  const xp = acc({ name: "Carteira XP", institutionId: 19, type: "BROKERAGE", visibleInCashFlow: false });
  const vr = acc({ name: "Vale-refeição", institutionId: 24, type: "BENEFIT", countsForOverallBalance: false });
  const wallet = acc({ institutionId: 1, type: "CASH" });
  const inter = acc({ institutionId: 8, active: false, accountNumber: "1100223-4" });
  const caixinha = acc({ name: "Conta conjunta", institutionName: "Cooperativa Vale Verde", type: "CHECKING" });

  /* cards */
  const card = (p: Omit<Dataset["cards"][number], "id" | "createdAt" | "active"> & { active?: boolean }) => {
    const id = nextId(ds);
    ds.cards.push({ id, active: true, createdAt: created, ...p });
    return id;
  };
  const nuCard = card({ name: "Nubank Ultravioleta", cardLimit: 15000, closeDay: 29, invoiceDueDay: 6, institutionId: 2, standardPaymentAccountId: nubank });
  const itauCard = card({ name: "Itaú Personnalité", cardLimit: 9000, closeDay: 3, invoiceDueDay: 10, institutionId: 3, standardPaymentAccountId: itau });
  const interCard = card({ name: null, cardLimit: 3000, closeDay: 10, invoiceDueDay: 17, institutionId: 8, standardPaymentAccountId: inter, active: false });

  /* releases */
  const push = (p: Partial<StoredRelease> & { type: ReleaseType; amount: number; date: ISODate }): StoredRelease => {
    const r: StoredRelease = {
      id: nextId(ds),
      done: p.date <= today,
      balanceAdjustment: false,
      countsInCashFlow: true,
      createdAt: `${p.date}T12:00:00.000Z`,
      ...p,
    };
    ds.releases.push(r);
    return r;
  };

  /** Variable spending only exists up to today (nobody forecasts every coffee). */
  const past = (p: Partial<StoredRelease> & { type: ReleaseType; amount: number; date: ISODate }) => {
    if (p.date <= today) push(p);
  };

  const series = (
    seriesId: string,
    fixedBy: FixedBy,
    fromMonth: string,
    count: number,
    day: number,
    make: (date: ISODate, i: number) => Partial<StoredRelease> & { type: ReleaseType; amount: number },
  ) => {
    for (let i = 0; i < count; i++) {
      const date = dayOf(shiftMonthKey(fromMonth, i), day);
      push({ ...make(date, i), date, seriesId, repeat: "FIXED", fixedBy });
    }
  };

  const months = 19; // 12 back + current + 6 ahead
  series("salary", "MONTHLY", startMonth, months, 5, () => ({ type: "R", amount: 9850, accountId: itau, description: "Salário", ...cat("Salário"), time: "08:00" }));
  series("rent", "MONTHLY", startMonth, months, 10, () => ({ type: "E", amount: 2650, accountId: itau, description: "Aluguel", ...cat("Moradia", "Aluguel") }));
  series("condo", "MONTHLY", startMonth, months, 10, () => ({ type: "E", amount: 690, accountId: itau, description: "Condomínio", ...cat("Moradia", "Condomínio") }));
  series("health", "MONTHLY", startMonth, months, 1, () => ({ type: "E", amount: 489.9, accountId: nubank, description: "Plano de saúde", ...cat("Saúde", "Plano de saúde") }));
  series("internet", "MONTHLY", startMonth, months, 15, () => ({ type: "E", amount: 119.9, creditCardId: nuCard, description: "Internet fibra", ...cat("Moradia", "Internet") }));
  series("video", "MONTHLY", startMonth, months, 12, () => ({ type: "E", amount: 55.9, creditCardId: nuCard, description: "Streaming de vídeo", ...cat("Lazer", "Streaming") }));
  series("music", "MONTHLY", startMonth, months, 18, () => ({ type: "E", amount: 21.9, creditCardId: nuCard, description: "Streaming de música", ...cat("Lazer", "Streaming") }));
  series("gym", "MONTHLY", startMonth, months, 3, () => ({ type: "E", amount: 129.9, creditCardId: itauCard, description: "Academia", ...cat("Bem-estar", "Academia") }));
  series("vr", "MONTHLY", startMonth, months, 1, () => ({ type: "R", amount: 1100, accountId: vr, description: "Crédito do vale-refeição", ...cat("Benefícios") }));
  series("move", "MONTHLY", startMonth, months, 6, () => ({ type: "T", amount: 1500, accountId: itau, targetAccountId: nubank, description: "Transferência mensal" }));
  series("save", "MONTHLY", startMonth, months, 7, () => ({ type: "T", amount: 600, accountId: nubank, targetAccountId: reserva, description: "Guardar na reserva" }));
  series("trip", "MONTHLY", shiftMonthKey(thisMonth, -6), 12, 7, () => ({ type: "T", amount: 300, accountId: nubank, targetAccountId: viagem, description: "Guardar para a viagem" }));
  series("invest", "MONTHLY", startMonth, months, 8, () => ({ type: "T", amount: 1000, accountId: itau, targetAccountId: xp, description: "Aporte mensal" }));
  series("ipva", "MONTHLY", shiftMonthKey(thisMonth, -8), 12, 8, () => ({ type: "T", amount: 250, accountId: itau, targetAccountId: ipva, description: "Guardar para o IPVA" }));
  series("fees", "MONTHLY", startMonth, months, 2, () => ({ type: "E", amount: 32.9, accountId: itau, description: "Pacote de serviços", ...cat("Impostos e taxas", "Tarifas bancárias") }));

  for (let i = 0; i <= 13; i++) {
    const mk = shiftMonthKey(startMonth, i);
    const isFutureMonth = mk > thisMonth;
    const d = (day: number) => dayOf(mk, day);
    push({ type: "E", amount: between(178, 326), date: d(18), accountId: itau, description: "Conta de luz", ...cat("Moradia", "Energia") });
    push({ type: "E", amount: between(84, 141), date: d(20), accountId: itau, description: "Conta de água", ...cat("Moradia", "Água") });
    if (isFutureMonth) continue;
    [2, 9, 16, 23, 29].forEach((day, k) =>
      past({ type: "E", amount: between(146, 538), date: d(day), ...(k % 2 === 0 ? { creditCardId: nuCard } : { accountId: nubank }), description: k === 4 ? "Hortifruti" : "Supermercado", ...cat("Alimentação", "Mercado"), time: `${String(9 + k * 2).padStart(2, "0")}:${k % 2 ? "15" : "40"}` }),
    );
    [3, 6, 11, 15, 22, 26].forEach((day) => past({ type: "E", amount: between(27, 74), date: d(day), accountId: vr, description: "Almoço", ...cat("Alimentação", "Restaurantes"), time: "12:40" }));
    [5, 14, 25].forEach((day) => past({ type: "E", amount: between(46, 112), date: d(day), creditCardId: nuCard, description: "Delivery", ...cat("Alimentação", "Delivery"), time: "20:30" }));
    [4, 19].forEach((day) => past({ type: "E", amount: between(218, 292), date: d(day), creditCardId: itauCard, description: "Posto Ipiranga", ...cat("Transporte", "Combustível") }));
    [2, 8, 13, 21, 27].forEach((day) => past({ type: "E", amount: between(17, 49), date: d(day), creditCardId: nuCard, description: "Corrida de app", ...cat("Transporte", "App de transporte") }));
    [9, 24].forEach((day) => past({ type: "E", amount: between(58, 184), date: d(day), creditCardId: nuCard, description: "Bar com amigos", ...cat("Lazer", "Bares"), time: "22:10" }));
    past({ type: "E", amount: between(38, 162), date: d(12), accountId: nubank, description: "Farmácia", ...cat("Saúde", "Farmácia") });
    past({ type: "E", amount: 189.9, date: d(14), accountId: nubank, description: "Ração", ...cat("Pets", "Ração") });
    past({ type: "E", amount: between(32, 81), date: d(13), accountId: wallet, description: "Feira", ...cat("Alimentação", "Padaria") });
    if (i % 3 === 0) past({ type: "E", amount: between(180, 610), date: d(17), creditCardId: itauCard, description: "Loja de roupas", ...cat("Compras", "Roupas") });
    if (i % 2 === 1) past({ type: "R", amount: between(1800, 4200), date: d(22), accountId: nubank, description: "Projeto freelance", ...cat("Freelance"), observation: i === 11 ? "Landing page para cliente" : null });
    past({ type: "R", amount: between(310, 395), date: d(28), accountId: xp, description: "Rendimento CDB", ...cat("Rendimentos") });
    past({ type: "R", amount: between(82, 118), date: d(28), accountId: reserva, description: "Rendimento da reserva", ...cat("Rendimentos") });
    if (i % 4 === 2) past({ type: "E", amount: between(90, 260), date: d(27), creditCardId: itauCard, description: "Presente", ...cat("Presentes") });
  }

  // Installment purchases
  const installments = (opts: { description: string; total: number; amount: number; purchase: ISODate; cardId?: Id; accountId?: Id; cat: ReturnType<typeof cat> }) => {
    const seriesId = `inst-${nextId(ds)}`;
    for (let k = 0; k < opts.total; k++) {
      push({
        type: "E",
        amount: opts.amount,
        date: addMonthsISO(opts.purchase, k),
        purchaseDate: opts.purchase,
        creditCardId: opts.cardId ?? null,
        accountId: opts.accountId ?? null,
        description: opts.description,
        ...opts.cat,
        seriesId,
        repeat: "INSTALLMENTS",
        installmentNumber: k + 1,
        totalInstallments: opts.total,
        done: opts.cardId ? true : addMonthsISO(opts.purchase, k) <= today,
      });
    }
  };
  installments({ description: "Notebook", total: 10, amount: 489.9, purchase: dayOf(shiftMonthKey(thisMonth, -4), 11), cardId: nuCard, cat: cat("Compras", "Eletrônicos") });
  installments({ description: "Sofá retrátil", total: 6, amount: 650, purchase: dayOf(shiftMonthKey(thisMonth, -2), 21), cardId: itauCard, cat: cat("Compras", "Casa e decoração") });
  installments({ description: "Passagens para Tóquio", total: 8, amount: 812.5, purchase: dayOf(shiftMonthKey(thisMonth, -1), 3), cardId: nuCard, cat: cat("Lazer", "Viagens") });
  installments({ description: "Curso de inglês", total: 12, amount: 349, purchase: dayOf(shiftMonthKey(thisMonth, -3), 15), accountId: itau, cat: cat("Educação", "Cursos") });

  // Specials
  const lastMonth = shiftMonthKey(thisMonth, -1);
  const dinner = push({ type: "E", amount: 420, date: dayOf(lastMonth, 17), accountId: nubank, description: "Jantar de aniversário", ...cat("Alimentação", "Restaurantes"), done: true, time: "21:15", observation: "Dividido com Lia e Caio" });
  push({ type: "R", amount: 140, date: dayOf(lastMonth, 19), accountId: nubank, description: "Pix da Lia", reimbursedReleaseId: dinner.id, done: true });
  push({ type: "R", amount: 140, date: addDaysISO(today, 4), accountId: nubank, description: "Pix do Caio", reimbursedReleaseId: dinner.id, done: false });
  push({ type: "E", amount: 1200, date: dayOf(lastMonth, 24), accountId: nubank, description: "Compra de dólares", ...cat("Lazer", "Viagens"), countsInCashFlow: false, observation: "Espécie para a viagem — não é gasto do mês" });
  push({ type: "E", amount: 42.5, date: dayOf(shiftMonthKey(thisMonth, -2), 28), accountId: wallet, balanceAdjustment: true, countsInCashFlow: false, description: "Ajuste de saldo", done: true });
  push({ type: "E", amount: 312.4, date: addDaysISO(today, -2), accountId: itau, description: "IPTU — parcela 10/10", ...cat("Moradia", "IPTU"), done: false });
  push({ type: "E", amount: 1468.33, date: today, accountId: itau, description: "Seguro do carro", ...cat("Transporte", "Seguro"), done: false });
  push({ type: "E", amount: 380, date: addDaysISO(today, 6), accountId: nubank, description: "Consulta dermatologista", ...cat("Saúde", "Consultas"), done: false });
  push({ type: "R", amount: 650, date: addDaysISO(today, 9), accountId: nubank, description: "Venda da bicicleta", ...cat("Vendas"), done: false });
  push({ type: "E", amount: 1890, date: dayOf(shiftMonthKey(thisMonth, 3), 15), accountId: ipva, description: "IPVA 2027", ...cat("Impostos e taxas", "IPVA"), done: false });
  push({ type: "R", amount: 9850, date: dayOf(shiftMonthKey(thisMonth, 2), 20), accountId: itau, description: "13º salário", ...cat("Salário", "13º salário"), done: false });
  push({ type: "E", amount: 260, date: dayOf(thisMonth, 2), accountId: caixinha, description: "Rateio das contas da casa", ...cat("Moradia"), done: true });

  // Archived Inter account & card history
  for (let k = 0; k < 3; k++) {
    const mk = shiftMonthKey(startMonth, k);
    push({ type: "E", amount: between(60, 180), date: dayOf(mk, 12), creditCardId: interCard, done: true, description: "Compra online", ...cat("Compras") });
    push({ type: "E", amount: 19.9, date: dayOf(mk, 4), accountId: inter, description: "Tarifa", ...cat("Impostos e taxas", "Tarifas bancárias") });
  }

  ds.releases.sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);

  /* invoice payments: every closed, past-due invoice is paid in full on its due date */
  for (const c of ds.cards) {
    ensureRows(ds, c, today);
    for (;;) {
      const cycles = buildCycles(ds, c, today);
      const next = cycles.find((cy) => cy.status === "CLOSED" && cy.dueDate < today && cy.outstanding > 0.004 && cy.payments.length === 0);
      if (!next || !next.row) break;
      ds.payments.push({
        id: nextId(ds),
        creditCardId: c.id,
        invoiceId: next.row.id,
        accountId: c.standardPaymentAccountId,
        amount: next.outstanding,
        date: addDaysISO(next.dueDate, -1),
        hour: "09:12",
        attachment: null,
        createdAt: `${next.dueDate}T09:12:00.000Z`,
      });
    }
  }

  /* calibrate opening balances so today's balances are realistic */
  const targets = new Map<Id, number>([
    [itau, 6842.17],
    [nubank, 3215.4],
    [reserva, 18450],
    [viagem, 4200],
    [ipva, 2350],
    [xp, 52380.12],
    [vr, 312.55],
    [wallet, 184],
    [inter, 0],
    [caixinha, 1240.5],
  ]);
  const doneUntilToday = computeBalances(ds);
  for (const a of ds.accounts) {
    const target = targets.get(a.id) ?? 0;
    a.initialBalance = round2(target - ((doneUntilToday.get(a.id) ?? 0) - a.initialBalance));
  }
  return ds;
}
