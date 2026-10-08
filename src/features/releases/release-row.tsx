"use client";
import * as React from "react";
import { ArrowLeftRight, Check, CreditCard, HandCoins, Paperclip, Pin, ReceiptText, Scale } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CategoryIcon } from "@/components/shared/category-icon";
import { Money } from "@/components/shared/money";
import { releaseTitle, signedAmount } from "@/domain/cash-flow";
import type { MonthlyRelease } from "@/domain/types";
import { formatDayMonth, monthLabel, referenceToMonthKey } from "@/lib/dates";
import { cn } from "@/lib/utils";

export function ReleaseGlyph({ r, size = "md" }: { r: MonthlyRelease; size?: "sm" | "md" }) {
  const box = size === "sm" ? "size-8 rounded-[9px] [&_svg]:size-4" : "size-10 rounded-[11px] [&_svg]:size-[18px]";
  if (r.kind === "INVOICE_PAYMENT")
    return (
      <span aria-hidden className={cn("grid shrink-0 place-items-center bg-surface-2 text-ink-2", box)}>
        <ReceiptText />
      </span>
    );
  if (r.balanceAdjustment)
    return (
      <span aria-hidden className={cn("grid shrink-0 place-items-center bg-surface-2 text-ink-2", box)}>
        <Scale />
      </span>
    );
  if (!r.category)
    return (
      <span aria-hidden className={cn("grid shrink-0 place-items-center", r.type === "T" ? "bg-transfer-soft text-transfer" : "bg-positive-soft text-positive", box)}>
        {r.type === "T" ? <ArrowLeftRight /> : <CategoryIconFallback />}
      </span>
    );
  return <CategoryIcon icon={r.category.icon} color={r.category.color} size={size} />;
}

function CategoryIconFallback() {
  return <HandCoins />;
}

function invoiceName(r: MonthlyRelease) {
  if (!r.invoiceMonthYear) return "";
  const base = monthLabel(referenceToMonthKey(r.invoiceMonthYear));
  return r.sharesReferenceMonth && r.invoiceCloseDay ? `${base} · fecha ${formatDayMonth(r.invoiceCloseDay)}` : base;
}

/** Secondary line of a release (§4.10). */
export function releaseSubtitle(r: MonthlyRelease, opts: { sourceColumnVisible?: boolean; omitSource?: boolean } = {}): React.ReactNode {
  if (r.type === "T") return `de ${r.account?.name ?? "—"} para ${r.targetAccount?.name ?? "—"}`;
  if (r.kind === "INVOICE_PAYMENT") return `Fatura de ${invoiceName(r)} · ${r.account?.name ?? ""}`;
  const parts: React.ReactNode[] = [];
  if (r.installmentNumber) parts.push(`${r.installmentNumber}/${r.totalInstallments}`);
  if (!opts.omitSource) parts.push(
    <span key="src" className={cn("inline-flex items-center gap-1", opts.sourceColumnVisible && "xl:hidden")}>
      {r.card && <CreditCard className="size-3" aria-label="Cartão" />}
      {r.card?.name ?? r.account?.name}
    </span>,
  );
  if (r.reimbursedReleaseId) parts.push("Reembolso");
  if (r.reimbursedAmount > 0)
    parts.push(
      <span key="re">
        reembolsado <Money value={r.reimbursedAmount} />
      </span>,
    );
  const srcIdx = opts.omitSource ? -1 : r.installmentNumber ? 1 : 0;
  return parts.filter(Boolean).map((p, i) => (
    <React.Fragment key={i}>
      {i > 0 && <span className={cn(opts.sourceColumnVisible && (i === srcIdx || (srcIdx === 0 && i === 1)) && "xl:hidden")}> · </span>}
      {p}
    </React.Fragment>
  ));
}

interface ReleaseRowProps {
  release: MonthlyRelease;
  onOpen: (r: MonthlyRelease) => void;
  onToggleDone?: (r: MonthlyRelease) => void;
  /** Show the "moved by hand" pin marker (hidden on the invoice screen). */
  showInvoicePin?: boolean;
  hideSourceColumn?: boolean;
  /** Omit the account/card from the subtitle (e.g. on the card's own invoice). */
  omitSource?: boolean;
}

/** One release in a list: tappable row + independent realized/pending toggle. */
export const ReleaseRow = React.memo(function ReleaseRow({ release: r, onOpen, onToggleDone, showInvoicePin = true, hideSourceColumn, omitSource }: ReleaseRowProps) {
  const title = releaseTitle(r);
  const amount = signedAmount(r);
  const amountTone = r.kind === "INVOICE_PAYMENT" ? "text-ink-2" : r.type === "E" ? "text-negative" : r.type === "R" ? "text-positive" : "text-transfer";
  return (
    <div className={cn("group flex items-center gap-3 rounded-[var(--radius-lg)] px-2 transition-colors hover:bg-surface-2 sm:px-3", !r.done && "opacity-[0.86]")}>
      <button type="button" onClick={() => onOpen(r)} className="flex min-w-0 flex-1 items-center gap-3 py-2.5 text-left outline-none focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-focus">
        <ReleaseGlyph r={r} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[15px] font-medium text-ink">{title}</span>
            {!r.countsInCashFlow && r.kind !== "INVOICE_PAYMENT" && r.type !== "T" && <Badge tone="outline">Fora do fluxo</Badge>}
            {showInvoicePin && r.invoicePinned && <Pin className="size-3 shrink-0 text-ink-3" aria-label="Fatura movida à mão" />}
            {r.attachmentName && <Paperclip className="size-3 shrink-0 text-ink-3" aria-label="Com anexo" />}
          </span>
          <span className="block truncate text-[13px] text-ink-3">{releaseSubtitle(r, { sourceColumnVisible: !hideSourceColumn, omitSource })}</span>
        </span>
        {!hideSourceColumn && (
          <span className="hidden w-44 shrink-0 truncate text-[13px] text-ink-3 xl:flex xl:items-center xl:gap-1">
            {r.card && <CreditCard className="size-3" aria-hidden />}
            {r.type === "T" ? "" : (r.card?.name ?? r.account?.name)}
          </span>
        )}
        <span className="hidden w-12 shrink-0 text-right text-[13px] tabular text-ink-3 sm:block">{r.time ?? ""}</span>
        <span className="shrink-0 text-right sm:w-28">
          <Money value={amount} signed={amount > 0} className={cn("text-[15px] font-semibold", amountTone)} />
          {!r.done && <span className="block text-[11px] font-medium text-warning">Pendente</span>}
        </span>
      </button>
      {onToggleDone && r.kind !== "INVOICE_PAYMENT" ? (
        <button
          type="button"
          onClick={() => onToggleDone(r)}
          aria-pressed={r.done}
          aria-label={r.done ? `${title}: realizado. Marcar como pendente` : `${title}: pendente. Marcar como realizado`}
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-full border transition-all",
            r.done ? "border-positive bg-positive text-white dark:text-[#0d1f15]" : "border-dashed border-line-strong text-transparent hover:border-ink-3 hover:text-ink-3",
          )}
        >
          <Check className="size-4" strokeWidth={3} aria-hidden />
        </button>
      ) : (
        <span className="size-8 shrink-0" aria-hidden />
      )}
    </div>
  );
});
