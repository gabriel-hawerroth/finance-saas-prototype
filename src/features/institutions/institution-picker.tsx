"use client";
import * as React from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { ErrorState, ListSkeleton } from "@/components/shared/content-state";
import { InstitutionLogo } from "@/components/shared/institution-logo";
import type { Id } from "@/domain/types";
import { ask } from "@/features/overlays/store";
import { normalize } from "@/lib/text";
import { useInstitutions } from "./queries";

export type InstitutionChoice = { institutionId?: Id; institutionName?: string };

/** Institution selector (§5.9): catalogue search + optional free-text "Outra". */
export function openInstitutionPicker(opts: { allowOther: boolean; allowWallet: boolean }): Promise<InstitutionChoice | null> {
  return ask<InstitutionChoice>((answer) => <Picker {...opts} onAnswer={answer} />);
}

function Picker({ allowOther, allowWallet, onAnswer }: { allowOther: boolean; allowWallet: boolean; onAnswer: (v: InstitutionChoice | null) => void }) {
  const q = useInstitutions();
  const [query, setQuery] = React.useState("");
  const [other, setOther] = React.useState<string | null>(null);
  const list = (q.data ?? []).filter((i) => (allowWallet || i.category !== "WALLET") && normalize(i.name).includes(normalize(query)));
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onAnswer(null)}
      title="Escolher instituição"
      size="sm"
      footer={
        other !== null ? (
          <div className="flex justify-end gap-2">
            <Button onClick={() => setOther(null)}>Voltar</Button>
            <Button variant="primary" disabled={!other.trim()} onClick={() => onAnswer({ institutionName: other.trim() })}>
              Usar
            </Button>
          </div>
        ) : undefined
      }
    >
      {other !== null ? (
        <Field label="Nome da instituição" htmlFor="ip-other" counter={{ value: other.length, max: 40 }}>
          <Input id="ip-other" autoFocus maxLength={40} value={other} onChange={(e) => setOther(e.target.value)} />
        </Field>
      ) : (
        <div className="grid gap-3 pb-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
            <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar" className="pl-9" aria-label="Buscar instituição" />
          </div>
          {q.isPending ? (
            <ListSkeleton rows={4} />
          ) : q.isError ? (
            <ErrorState compact onRetry={() => q.refetch()} />
          ) : (
            <ul className="scrollbar-thin grid max-h-[50dvh] gap-0.5 overflow-y-auto">
              {list.map((i) => (
                <li key={i.id}>
                  <button type="button" onClick={() => onAnswer({ institutionId: i.id })} className="flex w-full items-center gap-3 rounded-[var(--radius-md)] px-2 py-2 text-left hover:bg-surface-2">
                    <InstitutionLogo institutionId={i.id} size="sm" />
                    <span className="text-sm">{i.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {allowOther && (
            <Button variant="link" className="justify-self-start" onClick={() => setOther(query.slice(0, 40))}>
              Outra instituição
            </Button>
          )}
        </div>
      )}
    </Modal>
  );
}
