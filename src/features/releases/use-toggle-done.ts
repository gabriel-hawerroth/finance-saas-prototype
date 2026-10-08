"use client";
import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/data/api";
import { invalidateFinancial } from "@/data/sync";
import { ERROR_MESSAGES, isApiError } from "@/domain/errors";
import type { InvoiceResolution, MonthlyRelease, PaidInvoiceConflictDetails } from "@/domain/types";
import { askPaidInvoice } from "./paid-invoice-dialog";

type Patch = (key: string, done: boolean) => void;

/**
 * Optimistic realized/pending toggle (§5.2): flips the row immediately, waits 400 ms
 * (lets a quick double-tap cancel), reverts on error and handles PAID_INVOICE and
 * REIMBURSED_EXPENSE_MUST_STAY_DONE.
 */
export function useToggleDone(patch: Patch) {
  const qc = useQueryClient();
  const pendingRef = React.useRef(new Map<string, ReturnType<typeof setTimeout>>());

  return (release: MonthlyRelease) => {
    const pending = pendingRef.current;
    const next = !release.done;
    patch(release.key, next);
    const existing = pending.get(release.key);
    if (existing) clearTimeout(existing);
    pending.set(
      release.key,
      setTimeout(async () => {
        pending.delete(release.key);
        const run = async (resolution?: InvoiceResolution): Promise<boolean> => {
          try {
            await api.releases.updateDone(release.id, next, resolution);
            return true;
          } catch (error) {
            if (isApiError(error, "PAID_INVOICE")) {
              const answer = await askPaidInvoice(error.details as PaidInvoiceConflictDetails);
              return answer ? run(answer) : false;
            }
            if (isApiError(error) && error.code) toast.warning(ERROR_MESSAGES[error.code]);
            else toast.error("Não foi possível atualizar o lançamento.");
            return false;
          }
        };
        const ok = await run();
        if (!ok) patch(release.key, !next);
        void invalidateFinancial(qc);
      }, 400),
    );
  };
}
