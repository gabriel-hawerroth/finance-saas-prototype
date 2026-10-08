import type { QueryClient } from "@tanstack/react-query";

/**
 * Cross-screen synchronisation (§5.12): after any financial mutation every screen
 * showing affected data refetches. Everything financial lives under the "fin" key,
 * so one invalidation keeps cash flow, invoices, accounts, home and reports coherent.
 */
export function invalidateFinancial(qc: QueryClient): Promise<void> {
  return qc.invalidateQueries({ queryKey: ["fin"] });
}
