"use client";
import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal, ModalActions } from "@/components/ui/modal";
import { ErrorState, ListSkeleton } from "@/components/shared/content-state";
import { Money } from "@/components/shared/money";
import { api } from "@/data/api";
import { qk } from "@/data/query-keys";
import { invalidateFinancial } from "@/data/sync";
import { isApiError } from "@/domain/errors";
import type { InvoiceOption, InvoiceResolution, MonthlyRelease, PaidInvoiceConflictDetails } from "@/domain/types";
import { openOverlay } from "@/features/overlays/store";
import { formatDate } from "@/lib/dates";
import { invoiceLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { askPaidInvoice } from "./paid-invoice-dialog";

export function openMoveInvoice(release: MonthlyRelease) {
  openOverlay((close) => <MoveInvoiceDialog release={release} onClose={close} />);
}

const optionKey = (o: InvoiceOption) => (o.invoiceId != null ? `id-${o.invoiceId}` : `close-${o.closeDay}`);
const STATUS: Record<InvoiceOption["status"], string> = { OPEN: "Aberta", FUTURE: "Futura", CLOSED: "Fechada" };

/** Move a card release to another invoice cycle, or back to "automatic" (§5.18). */
function MoveInvoiceDialog({ release, onClose }: { release: MonthlyRelease; onClose: () => void }) {
  const qc = useQueryClient();
  const cardId = release.card!.id;
  const q = useQuery({ queryKey: qk.invoices(cardId), queryFn: () => api.invoices.byCard(cardId) });
  const currentKey = release.invoicePinned && release.invoiceId != null ? `id-${release.invoiceId}` : "auto";
  const [selected, setSelected] = React.useState(currentKey);
  const [saving, setSaving] = React.useState(false);
  const listRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!q.data) return;
    const el = listRef.current?.querySelector<HTMLElement>("[data-current='true']") ?? listRef.current?.querySelector<HTMLElement>("[data-open='true']");
    el?.scrollIntoView({ block: "center" });
  }, [q.data]);

  const save = async () => {
    if (selected === currentKey) {
      onClose();
      return;
    }
    const option = q.data?.find((o) => optionKey(o) === selected);
    const target = selected === "auto" ? null : option?.invoiceId != null ? { invoiceId: option.invoiceId } : { closeDate: option?.closeDay };
    setSaving(true);
    const run = async (resolution?: InvoiceResolution): Promise<boolean> => {
      try {
        await api.releases.updateInvoice(release.id, target, resolution);
        return true;
      } catch (error) {
        if (isApiError(error, "PAID_INVOICE")) {
          const a = await askPaidInvoice(error.details as PaidInvoiceConflictDetails);
          return a ? run(a) : false;
        }
        toast.error("Não foi possível trocar a fatura.");
        return false;
      }
    };
    if (await run()) {
      toast.success(option && selected !== "auto" ? `Movido para a fatura de ${invoiceLabel(option)}` : "Voltou a seguir a data da compra");
      void invalidateFinancial(qc);
      onClose();
    }
    setSaving(false);
  };

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title="Trocar fatura"
      description="Escolha em qual fatura este lançamento deve entrar."
      size="md"
      footer={
        <ModalActions>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={save} loading={saving}>
            Confirmar
          </Button>
        </ModalActions>
      }
    >
      <div role="radiogroup" aria-label="Faturas" ref={listRef} className="grid gap-1.5">
        <Choice checked={selected === "auto"} onSelect={() => setSelected("auto")} icon={<Wand2 className="size-4" aria-hidden />} title="Automático — pela data da compra" />
        {q.isPending && <ListSkeleton rows={4} className="mt-2" />}
        {q.isError && <ErrorState compact onRetry={() => q.refetch()} retrying={q.isFetching} />}
        {q.data?.map((o) => {
          const key = optionKey(o);
          const isCurrent = o.invoiceId != null && o.invoiceId === release.invoiceId;
          return (
            <Choice
              key={key}
              checked={selected === key}
              onSelect={() => setSelected(key)}
              dataCurrent={isCurrent}
              dataOpen={o.status === "OPEN"}
              title={invoiceLabel(o)}
              subtitle={`Vence ${formatDate(o.dueDate)}`}
              trailing={
                <span className="flex items-center gap-1.5">
                  {isCurrent && <Badge tone="brand">Atual</Badge>}
                  {o.settled ? <Badge tone="positive">Quitada</Badge> : <Badge>{STATUS[o.status]}</Badge>}
                  <Money value={o.amount} className="text-xs text-ink-3" />
                </span>
              }
            />
          );
        })}
      </div>
    </Modal>
  );
}

function Choice(props: { checked: boolean; onSelect: () => void; title: string; subtitle?: string; icon?: React.ReactNode; trailing?: React.ReactNode; dataCurrent?: boolean; dataOpen?: boolean }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={props.checked}
      onClick={props.onSelect}
      data-current={props.dataCurrent || undefined}
      data-open={props.dataOpen || undefined}
      className={cn(
        "flex items-center gap-3 rounded-[var(--radius-lg)] border px-3 py-2.5 text-left transition-colors",
        props.checked ? "border-ink bg-surface-2" : "border-line hover:bg-surface-2",
      )}
    >
      <span className={cn("grid size-5 shrink-0 place-items-center rounded-full border", props.checked ? "border-ink bg-ink text-bg" : "border-line-strong")}>
        {props.checked && <Check className="size-3" strokeWidth={3} aria-hidden />}
      </span>
      {props.icon}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{props.title}</span>
        {props.subtitle && <span className="block text-xs text-ink-3">{props.subtitle}</span>}
      </span>
      {props.trailing}
    </button>
  );
}
