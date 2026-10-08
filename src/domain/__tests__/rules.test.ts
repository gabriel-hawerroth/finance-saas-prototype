import { describe, expect, it } from "vitest";
import { closeToDueGap, isAtypicalCycle, isUnusualGap, skipsMonth, suggestCloseDay } from "../card-cycle";
import { defaultDone, defaultReleaseDate, normalizeInstallments, suggestedRepeatCount } from "../release-form";
import { checkPassword, isPasswordValid } from "../password";
import { canResend, formatCountdown, isExpired, registerResend, remainingAttempts, startResendTimer } from "../email-resend";
import { invoiceForecast, maxPaymentAllowed, pickInitialCycle } from "../invoice";
import { goalProgress, limitUsage } from "../accounts-view";
import { suggestCategory } from "../suggested-category";
import type { CategoryWithSubs, InvoiceOption, InvoicePayment } from "../types";
import { release } from "./fixtures";

describe("card cycle rules (C8–C10)", () => {
  it("suggests close day = due − 7, wrapping the month, capped at 28", () => {
    expect(suggestCloseDay(3)).toBe(27);
    expect(suggestCloseDay(5)).toBe(28);
    expect(suggestCloseDay(10)).toBe(3);
    expect(suggestCloseDay(20)).toBe(13);
  });
  it("flags unusual close→due gaps outside 1–15 days", () => {
    expect(closeToDueGap(10, 17)).toBe(7);
    expect(closeToDueGap(25, 5)).toBe(10);
    expect(closeToDueGap(8, 8)).toBe(0);
    expect(isUnusualGap(8, 8)).toBe(true);
    expect(isUnusualGap(1, 25)).toBe(true);
    expect(isUnusualGap(29, 6)).toBe(false);
  });
  it("detects atypical cycles and skipped months", () => {
    expect(isAtypicalCycle(14)).toBe(true);
    expect(isAtypicalCycle(30)).toBe(false);
    expect(isAtypicalCycle(46)).toBe(true);
    expect(skipsMonth({ transition: true, days: 40 })).toBe(true);
    expect(skipsMonth({ transition: false, days: 40 })).toBe(false);
  });
});

describe("release form defaults (C12, C13)", () => {
  it("uses today in the current month and day 1 otherwise", () => {
    expect(defaultReleaseDate("2026-10", "2026-10-08")).toBe("2026-10-08");
    expect(defaultReleaseDate("2026-12", "2026-10-08")).toBe("2026-12-01");
  });
  it("marks installments as done and future dates as pending", () => {
    expect(defaultDone("2027-01-01", "INSTALLMENTS", "2026-10-08")).toBe(true);
    expect(defaultDone("2026-10-08", null, "2026-10-08")).toBe(true);
    expect(defaultDone("2026-10-09", "FIXED", "2026-10-08")).toBe(false);
  });
  it("suggests counts per periodicity and clamps installments", () => {
    expect(suggestedRepeatCount("DAILY")).toBe(365);
    expect(suggestedRepeatCount("WEEKLY")).toBe(52);
    expect(suggestedRepeatCount("ANNUAL")).toBe(5);
    expect(normalizeInstallments(1)).toBe(2);
    expect(normalizeInstallments(500)).toBe(199);
    expect(normalizeInstallments(12)).toBe(12);
  });
});

describe("password policy (C20)", () => {
  it("requires length, uppercase, digit and special", () => {
    expect(isPasswordValid("Finax@2026")).toBe(true);
    expect(isPasswordValid("finax@2026")).toBe(false);
    expect(isPasswordValid("Finax2026")).toBe(false);
    expect(checkPassword("Ab1!").find((c) => c.key === "length")?.ok).toBe(false);
  });
});

describe("e-mail resend timer (C19)", () => {
  it("unlocks after 2 min, then 3 min, then blocks for 1 h and expires", () => {
    let s = startResendTimer(0);
    expect(canResend(s, 60_000)).toBe(false);
    expect(canResend(s, 120_000)).toBe(true);
    s = registerResend(s, 120_000);
    expect(remainingAttempts(s)).toBe(1);
    expect(canResend(s, 120_000 + 179_000)).toBe(false);
    s = registerResend(s, 300_000);
    expect(remainingAttempts(s)).toBe(0);
    expect(canResend(s, 300_000 + 3_600_000)).toBe(false);
    expect(isExpired(s, 300_000 + 3_600_000)).toBe(true);
  });
  it("formats countdowns", () => {
    expect(formatCountdown(65_000)).toBe("1:05");
    expect(formatCountdown(3_660_000)).toBe("1h 01m");
  });
});

describe("invoice rules (C2, C3, C16)", () => {
  const opt = (p: Partial<InvoiceOption>): InvoiceOption => ({ invoiceId: null, referenceMonth: "10/2026", sharesReferenceMonth: false, firstDay: "2026-09-01", closeDay: "2026-09-30", dueDate: "2026-10-07", status: "CLOSED", settled: true, amount: 0, outstanding: 0, ...p });
  const options = [opt({ invoiceId: 1, closeDay: "2026-08-30" }), opt({ invoiceId: 2, closeDay: "2026-09-30", status: "OPEN" }), opt({ closeDay: "2026-10-30", status: "FUTURE" })];

  it("picks deep link, then remembered, then open, then first not closed, then last", () => {
    expect(pickInitialCycle(options, 1, 2)?.invoiceId).toBe(1);
    expect(pickInitialCycle(options, null, 1)?.invoiceId).toBe(1);
    expect(pickInitialCycle(options, 999, null)?.invoiceId).toBe(2);
    expect(pickInitialCycle([options[0], options[2]], null, null)?.closeDay).toBe("2026-10-30");
    expect(pickInitialCycle([options[0]], null, null)?.invoiceId).toBe(1);
    expect(pickInitialCycle([], null, null)).toBeNull();
  });

  it("limits a payment to what remains of the invoice, excluding the payment being edited", () => {
    const payments = [{ id: 1, paymentAmount: 300 }, { id: 2, paymentAmount: 200 }] as InvoicePayment[];
    expect(maxPaymentAllowed(1000, payments)).toBe(500);
    expect(maxPaymentAllowed(1000, payments, 2)).toBe(700);
  });

  it("adds pending releases of the cycle to the forecast", () => {
    expect(invoiceForecast({ amount: 100, releases: [release({ amount: 40, done: false }), release({ amount: 60, done: true })] })).toBe(140);
  });
});

describe("account presentation rules (C6, C7, C18)", () => {
  it("computes goal progress and limit usage clamped to 0–100", () => {
    expect(goalProgress(150, 300)).toBe(50);
    expect(goalProgress(500, 300)).toBe(100);
    expect(goalProgress(-10, 300)).toBe(0);
    expect(goalProgress(10, null)).toBeNull();
    expect(limitUsage(1000, 250)).toBe(75);
    expect(limitUsage(1000, -50)).toBe(100);
  });

  it("suggests categories by accent-free name prefix, alphabetically", () => {
    const c = (id: number, name: string, type: "E" | "R", active = true) => ({ id, name, type, active, color: "", icon: "", essential: false, createdAt: "", subcategories: [] }) as CategoryWithSubs;
    const cats = [c(1, "Rendimentos", "R"), c(2, "Impostos e taxas", "E"), c(3, "Valorização", "R"), c(4, "Imposto antigo", "E", false), c(5, "Desvalorização", "E")];
    expect(suggestCategory(cats, "INCOME_YIELD")?.id).toBe(1);
    expect(suggestCategory(cats, "TAX")?.id).toBe(2);
    expect(suggestCategory(cats, "APPRECIATION")?.id).toBe(3);
    expect(suggestCategory(cats, "DEPRECIATION")?.id).toBe(5);
  });
});
