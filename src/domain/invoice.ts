import { round2 } from "@/lib/utils";
import type { Id, InvoiceCycleValues, InvoiceOption, InvoicePayment } from "./types";

/**
 * C16 — initial invoice cycle: deep link → last visited → OPEN → first not closed → last.
 * Returns the close date that addresses the cycle.
 */
export function pickInitialCycle(
  options: readonly InvoiceOption[],
  deepLinkInvoiceId: Id | null,
  rememberedInvoiceId: Id | null,
): InvoiceOption | null {
  if (options.length === 0) return null;
  const byId = (id: Id | null) => (id == null ? undefined : options.find((o) => o.invoiceId === id));
  return (
    byId(deepLinkInvoiceId) ??
    byId(rememberedInvoiceId) ??
    options.find((o) => o.status === "OPEN") ??
    options.find((o) => o.status !== "CLOSED") ??
    options[options.length - 1]
  );
}

/**
 * C2 — forecast = amount + pending releases of the cycle. In this product the server's
 * `amount` only counts done releases, so pending ones are added once (no double counting).
 */
export function invoiceForecast(values: Pick<InvoiceCycleValues, "amount" | "releases">): number {
  return round2(values.amount + values.releases.filter((r) => !r.done && r.kind === "RELEASE").reduce((a, r) => a + r.amount, 0));
}

/**
 * C3 — payments of an invoice (excluding the one being edited) + this one must not exceed
 * the invoice amount. Returns the maximum allowed for this payment.
 */
export function maxPaymentAllowed(amount: number, payments: readonly InvoicePayment[], editingId?: Id | null): number {
  const others = payments.filter((p) => p.id !== editingId).reduce((a, p) => a + p.paymentAmount, 0);
  return round2(Math.max(0, amount - others));
}

export function totalPaid(payments: readonly InvoicePayment[]): number {
  return round2(payments.reduce((a, p) => a + p.paymentAmount, 0));
}
