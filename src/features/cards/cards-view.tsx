"use client";
import * as React from "react";
import Link from "next/link";
import { CreditCard, Plus, Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/menu";
import { Progress } from "@/components/ui/progress";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState, ErrorState } from "@/components/shared/content-state";
import { InstitutionLogo } from "@/components/shared/institution-logo";
import { Money } from "@/components/shared/money";
import { PageHeader } from "@/components/shared/page-header";
import { limitUsage } from "@/domain/accounts-view";
import type { CreditCard as Card } from "@/domain/types";
import { useCards } from "@/features/picklists/queries";
import { formatDayMonth } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { openCardDetails } from "./card-details";
import { openNewCardWizard } from "./new-card-wizard";

type Situation = "ALL" | "ACTIVE" | "INACTIVE";

const STATE_LABEL = { OPEN: "Aberta", CLOSED: "Fechada", PAID: "Paga" } as const;

function CardTile({ card }: { card: Card }) {
  const s = card.invoiceSummary;
  const value = s.state === "CLOSED" ? s.outstanding : s.amount;
  const deadline = s.state === "OPEN" ? `Fecha em ${formatDayMonth(s.closeDate)}` : s.state === "CLOSED" ? `Vence em ${formatDayMonth(s.dueDate)}` : `Paga · vence ${formatDayMonth(s.dueDate)}`;
  const usage = limitUsage(card.cardLimit, s.availableLimit);
  return (
    <li className={cn("group relative rounded-[var(--radius-2xl)] border border-line bg-surface transition-shadow hover:shadow-[var(--shadow-lift)]", !card.active && "opacity-70")}>
      <Link href={`/cartoes-de-credito/fatura/${card.id}`} className="block rounded-[var(--radius-2xl)] p-5 outline-none focus-visible:ring-2 focus-visible:ring-focus">
        <div className="flex items-center gap-3 pr-10">
          <InstitutionLogo institutionId={card.institutionId} name={card.displayName} />
          <div className="min-w-0">
            <p className="truncate font-semibold">{card.displayName}</p>
            <p className="text-xs text-ink-3">{deadline}</p>
          </div>
        </div>
        <div className="mt-6 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs text-ink-3">{s.state === "CLOSED" ? "Restante a pagar" : "Fatura"}</p>
            <p className="font-display text-[34px] leading-none">
              <Money value={value} />
            </p>
          </div>
          <Badge tone={s.state === "CLOSED" ? "warning" : s.state === "PAID" ? "positive" : "neutral"} size="md">
            {STATE_LABEL[s.state]}
          </Badge>
        </div>
        <div className="mt-5 grid gap-1.5">
          <Progress value={usage} label={`Uso do limite de ${card.displayName}`} tone={usage > 85 ? "negative" : "ink"} />
          <p className="text-xs text-ink-3">
            Disponível <Money value={s.availableLimit} className="font-medium text-ink-2" /> de <Money value={card.cardLimit} />
          </p>
        </div>
        {!card.active && <Badge tone="warning" className="mt-3">Arquivado</Badge>}
      </Link>
      <Tooltip content="Configurações do cartão">
        <Button variant="ghost" size="icon-sm" className="absolute right-3 top-3" aria-label={`Configurações do cartão ${card.displayName}`} onClick={() => openCardDetails(card.id)}>
          <Settings2 />
        </Button>
      </Tooltip>
    </li>
  );
}

export function CardsView() {
  const q = useCards();
  const [situation, setSituation] = React.useState<Situation>("ACTIVE");
  const list = (q.data ?? []).filter((c) => situation === "ALL" || (situation === "ACTIVE" ? c.active : !c.active));
  return (
    <div className="grid gap-7">
      <PageHeader
        eyebrow="Crédito"
        title="Cartões de crédito"
        description="Toque num cartão para abrir a fatura."
        actions={
          <Button variant="primary" onClick={openNewCardWizard}>
            <Plus aria-hidden /> Novo cartão
          </Button>
        }
      />
      <Segmented
        label="Situação"
        value={situation}
        onValueChange={setSituation}
        className="w-fit"
        options={[
          { value: "ALL", label: "Todos" },
          { value: "ACTIVE", label: "Ativos" },
          { value: "INACTIVE", label: "Inativos" },
        ]}
      />
      {q.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-56 rounded-[var(--radius-2xl)]" />
          ))}
        </div>
      ) : q.isError ? (
        <ErrorState onRetry={() => q.refetch()} retrying={q.isFetching} />
      ) : (q.data ?? []).length === 0 ? (
        <EmptyState icon={<CreditCard />} title="Nenhum cartão cadastrado" message="Cadastre um cartão para acompanhar faturas e limite." action={<Button variant="primary" onClick={openNewCardWizard}><Plus aria-hidden /> Novo cartão</Button>} />
      ) : list.length === 0 ? (
        <EmptyState icon={<CreditCard />} title="Nenhum cartão neste filtro" />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((c) => (
            <CardTile key={c.id} card={c} />
          ))}
        </ul>
      )}
    </div>
  );
}
