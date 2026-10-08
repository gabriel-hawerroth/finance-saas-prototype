import type { AccountType, CurrencySymbol, FixedBy, Language } from "./types";

/** Fixed palette offered for categories (17 colours, §3.6). Chosen to stay legible on both themes. */
export const CATEGORY_COLORS = [
  "#e5484d", "#f76b15", "#e2a336", "#b5a33a", "#7cb342", "#30a46c", "#12a594", "#0894b3",
  "#0d74ce", "#3e63dd", "#6e56cf", "#8e4ec6", "#ab4aba", "#d6409f", "#c2298a", "#8d7f6c", "#687076",
] as const;

/** Fixed icon set for categories (79 icons, §3.6). Names are lucide-react exports. */
export const CATEGORY_ICONS = [
  "Utensils", "ShoppingCart", "ShoppingBag", "Car", "Fuel", "Bus", "Plane", "House", "Lightbulb", "Droplet",
  "Flame", "Wifi", "Smartphone", "Tv", "HeartPulse", "Pill", "Stethoscope", "Dumbbell", "GraduationCap",
  "BookOpen", "Baby", "Dog", "Cat", "Gift", "PartyPopper", "Music", "Film", "Gamepad2", "Shirt", "Scissors",
  "Sparkles", "Coffee", "Beer", "Wine", "Pizza", "Sandwich", "IceCreamCone", "Apple", "Briefcase", "Laptop",
  "Wrench", "Hammer", "Paintbrush", "Sofa", "Bed", "Bath", "TreePine", "Sprout", "Bike", "Train",
  "ParkingCircle", "Ticket", "Hotel", "Luggage", "Umbrella", "Shield", "Landmark", "Receipt", "FileText",
  "Percent", "BadgeDollarSign", "Banknote", "Coins", "PiggyBank", "TrendingUp", "ChartLine", "Wallet",
  "CreditCard", "HandCoins", "HandHeart", "Heart", "Church", "Users", "User", "Building2", "Store", "Package",
  "Ellipsis", "CircleDollarSign",
] as const;
export type CategoryIconName = (typeof CATEGORY_ICONS)[number];

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  CHECKING: "Conta corrente",
  SAVING: "Poupança",
  BROKERAGE: "Investimentos",
  BENEFIT: "Benefício",
  CASH: "Dinheiro",
};

export const ACCOUNT_TYPE_SHORT: Record<AccountType, string> = {
  CHECKING: "Corrente",
  SAVING: "Poupança",
  BROKERAGE: "Investimentos",
  BENEFIT: "Benefício",
  CASH: "Dinheiro",
};

export const LANGUAGES: { value: Language; label: string }[] = [
  { value: "pt-BR", label: "Português" },
  { value: "en-US", label: "English" },
  { value: "es-CO", label: "Español" },
  { value: "de-DE", label: "Deutsch" },
];

export const CURRENCIES: { value: CurrencySymbol; label: string }[] = [
  { value: "R$", label: "Real brasileiro" },
  { value: "$", label: "Dólar" },
  { value: "€", label: "Euro" },
  { value: "£", label: "Libra" },
  { value: "¥", label: "Yuan" },
];

export const FIXED_BY_OPTIONS: { value: FixedBy; label: string; unit: [string, string]; suggested: number }[] = [
  { value: "DAILY", label: "Diário", unit: ["dia", "dias"], suggested: 365 },
  { value: "WEEKLY", label: "Semanal", unit: ["semana", "semanas"], suggested: 52 },
  { value: "MONTHLY", label: "Mensal", unit: ["mês", "meses"], suggested: 12 },
  { value: "BIMONTHLY", label: "Bimestral", unit: ["bimestre", "bimestres"], suggested: 12 },
  { value: "QUARTERLY", label: "Trimestral", unit: ["trimestre", "trimestres"], suggested: 8 },
  { value: "BIANNUAL", label: "Semestral", unit: ["semestre", "semestres"], suggested: 6 },
  { value: "ANNUAL", label: "Anual", unit: ["ano", "anos"], suggested: 5 },
];

export const ATTACHMENT_MAX_BYTES = 3 * 1024 * 1024;
export const ATTACHMENT_EXTENSIONS = ["pdf", "jpg", "jpeg", "png", "jfif", "webp"] as const;
export const PROFILE_IMAGE_EXTENSIONS = ["jpg", "jpeg", "jfif", "png", "webp"] as const;

/** Names of the protected default categories (§3.6). */
export const PROTECTED_CATEGORY_NAMES = ["Outras Despesas", "Outras Receitas"];
