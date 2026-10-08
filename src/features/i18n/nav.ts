import { usePrefs } from "@/features/prefs/store";
import type { Language } from "@/domain/types";

/**
 * Shell vocabulary in the four supported languages. Page content is authored in
 * pt-BR; dates, months and the shell follow the chosen language.
 */
const DICT = {
  "pt-BR": { home: "Início", cashflow: "Fluxo de caixa", cashflowShort: "Fluxo", accounts: "Contas", cards: "Cartões de crédito", cardsShort: "Cartões", categories: "Categorias", reports: "Relatórios", byCategory: "Por categoria", byAccount: "Por conta", balance: "Evolução do saldo", profile: "Meu perfil", settings: "Configurações", logout: "Sair", newRelease: "Novo lançamento", expense: "Despesa", revenue: "Receita", transfer: "Transferência", search: "Buscar ou executar…", hideValues: "Ocultar valores", showValues: "Mostrar valores", more: "Mais" },
  "en-US": { home: "Home", cashflow: "Cash flow", cashflowShort: "Flow", accounts: "Accounts", cards: "Credit cards", cardsShort: "Cards", categories: "Categories", reports: "Reports", byCategory: "By category", byAccount: "By account", balance: "Balance over time", profile: "My profile", settings: "Settings", logout: "Sign out", newRelease: "New entry", expense: "Expense", revenue: "Income", transfer: "Transfer", search: "Search or run…", hideValues: "Hide amounts", showValues: "Show amounts", more: "More" },
  "es-CO": { home: "Inicio", cashflow: "Flujo de caja", cashflowShort: "Flujo", accounts: "Cuentas", cards: "Tarjetas de crédito", cardsShort: "Tarjetas", categories: "Categorías", reports: "Informes", byCategory: "Por categoría", byAccount: "Por cuenta", balance: "Evolución del saldo", profile: "Mi perfil", settings: "Configuración", logout: "Salir", newRelease: "Nuevo movimiento", expense: "Gasto", revenue: "Ingreso", transfer: "Transferencia", search: "Buscar o ejecutar…", hideValues: "Ocultar valores", showValues: "Mostrar valores", more: "Más" },
  "de-DE": { home: "Start", cashflow: "Cashflow", cashflowShort: "Cashflow", accounts: "Konten", cards: "Kreditkarten", cardsShort: "Karten", categories: "Kategorien", reports: "Berichte", byCategory: "Nach Kategorie", byAccount: "Nach Konto", balance: "Saldoverlauf", profile: "Mein Profil", settings: "Einstellungen", logout: "Abmelden", newRelease: "Neue Buchung", expense: "Ausgabe", revenue: "Einnahme", transfer: "Überweisung", search: "Suchen oder ausführen…", hideValues: "Beträge ausblenden", showValues: "Beträge anzeigen", more: "Mehr" },
} satisfies Record<Language, Record<string, string>>;

export type NavKey = keyof (typeof DICT)["pt-BR"];

export function useNavT() {
  const language = usePrefs((s) => s.language);
  return (key: NavKey) => DICT[language][key];
}
