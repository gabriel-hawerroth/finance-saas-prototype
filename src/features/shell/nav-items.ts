import { ChartPie, CreditCard, House, Landmark, ArrowLeftRight, Tags, type LucideIcon } from "lucide-react";
import type { NavKey } from "@/features/i18n/nav";

export interface NavItem {
  key: NavKey;
  href: string;
  icon: LucideIcon;
  /** Extra path prefixes that mark the item active. */
  match?: string[];
  children?: { key: NavKey; href: string }[];
}

export const NAV_ITEMS: NavItem[] = [
  { key: "home", href: "/home", icon: House },
  { key: "cashflow", href: "/fluxo-de-caixa", icon: ArrowLeftRight },
  { key: "accounts", href: "/contas", icon: Landmark },
  { key: "cards", href: "/cartoes-de-credito", icon: CreditCard },
  { key: "categories", href: "/categorias", icon: Tags },
  {
    key: "reports",
    href: "/relatorios/por-categoria",
    icon: ChartPie,
    match: ["/relatorios"],
    children: [
      { key: "byCategory", href: "/relatorios/por-categoria" },
      { key: "byAccount", href: "/relatorios/por-conta" },
      { key: "balance", href: "/relatorios/evolucao-saldo" },
    ],
  },
];

export function isActive(pathname: string, item: Pick<NavItem, "href" | "match">): boolean {
  const prefixes = item.match ?? [item.href];
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
