import type { MonthlyRelease } from "../types";

let seq = 1;
export function release(p: Partial<MonthlyRelease> = {}): MonthlyRelease {
  const id = p.id ?? seq++;
  return {
    key: `RELEASE-${id}`,
    id,
    kind: "RELEASE",
    type: "E",
    amount: 10,
    date: "2026-10-05",
    done: true,
    isDuplicatedRelease: false,
    balanceAdjustment: false,
    countsInCashFlow: true,
    countsInMonthTotals: true,
    invoicePinned: false,
    reimbursements: [],
    reimbursedAmount: 0,
    netAmount: p.amount ?? 10,
    reimbursableAmount: 0,
    canRegisterReimbursement: false,
    createdAt: "2026-10-05T12:00:00.000Z",
    ...p,
  };
}
