import { normalize } from "@/lib/text";
import type { CategoryType, CategoryWithSubs } from "./types";

export type SuggestionKind = "INCOME_YIELD" | "APPRECIATION" | "DEPRECIATION" | "TAX";

const PATTERNS: Record<SuggestionKind, { type: CategoryType; test: (name: string) => boolean }> = {
  INCOME_YIELD: { type: "R", test: (n) => /^rendimentos?\b/.test(n) },
  APPRECIATION: { type: "R", test: (n) => n.startsWith("valorizac") },
  DEPRECIATION: { type: "E", test: (n) => n.startsWith("desvalorizac") || n.startsWith("valorizac") },
  TAX: { type: "E", test: (n) => /^impostos?\b/.test(n) },
};

/** C18 — first active category, alphabetically, of the right type whose accent-free name matches. */
export function suggestCategory(categories: readonly CategoryWithSubs[], kind: SuggestionKind): CategoryWithSubs | null {
  const { type, test } = PATTERNS[kind];
  return (
    [...categories]
      .filter((c) => c.active && c.type === type)
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
      .find((c) => test(normalize(c.name))) ?? null
  );
}
