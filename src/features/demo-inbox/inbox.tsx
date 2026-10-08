"use client";
import * as React from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, MailOpen } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Tooltip } from "@/components/ui/menu";
import { EmptyState } from "@/components/shared/content-state";
import { api } from "@/data/api";
import { qk } from "@/data/query-keys";
import { cn } from "@/lib/utils";

export function useInbox() {
  return useQuery({ queryKey: qk.inbox, queryFn: api.auth.inbox, refetchInterval: 4000 });
}

/**
 * The prototype has no e-mail server: activation, password recovery and
 * cancellation messages land in this simulated inbox, so every flow is testable.
 */
export function DemoInboxButton({ className, label = false }: { className?: string; label?: boolean }) {
  const [open, setOpen] = React.useState(false);
  const { data = [], refetch } = useInbox();
  const qc = useQueryClient();
  const unread = data.filter((m) => !m.read).length;
  return (
    <>
      <Tooltip content="Caixa de entrada simulada">
        <Button variant="ghost" size={label ? "sm" : "icon-sm"} className={cn("relative", className)} onClick={() => {
            void refetch();
            setOpen(true);
          }} aria-label={`Caixa de entrada simulada${unread ? `, ${unread} não lidas` : ""}`}>
          <Mail aria-hidden />
          {label && <span>E-mails</span>}
          {unread > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-negative px-1 text-[10px] font-semibold text-white">{unread}</span>}
        </Button>
      </Tooltip>
      <Modal open={open} onOpenChange={setOpen} title="Caixa de entrada" description="E-mails simulados pelo protótipo (nenhuma mensagem real é enviada)." size="md">
        {data.length === 0 ? (
          <EmptyState icon={<MailOpen />} title="Nenhum e-mail ainda" message="Cadastre-se, peça a recuperação de senha ou o cancelamento da conta para receber mensagens aqui." compact />
        ) : (
          <ul className="grid gap-2 pb-2">
            {data.map((m) => (
              <li key={m.id} className={cn("rounded-[var(--radius-lg)] border p-4", m.read ? "border-line" : "border-ink")}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-medium text-ink">{m.subject}</p>
                  <span className="shrink-0 text-xs text-ink-3">{formatDistanceToNow(m.sentAt, { locale: ptBR, addSuffix: true })}</span>
                </div>
                <p className="mt-0.5 text-xs text-ink-3">Para: {m.to}</p>
                <p className="mt-2 text-sm text-ink-2">{m.body}</p>
                <Button
                  asChild
                  variant="primary"
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    void api.auth.markEmailRead(m.id).then(() => qc.invalidateQueries({ queryKey: qk.inbox }));
                    setOpen(false);
                  }}
                >
                  <Link href={m.link}>{m.linkLabel}</Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </>
  );
}
