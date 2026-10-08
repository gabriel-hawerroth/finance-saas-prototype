"use client";
import * as React from "react";
import { Command } from "cmdk";
import { Dialog } from "radix-ui";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { CreditCard, Eye, Landmark, LogOut, Moon, Plus, Search, Settings, Sun, User } from "lucide-react";
import { Kbd } from "@/components/ui/kbd";
import { InstitutionLogo } from "@/components/shared/institution-logo";
import { useNavT } from "@/features/i18n/nav";
import { usePicklists } from "@/features/picklists/queries";
import { usePrefs } from "@/features/prefs/store";
import { openNewAccountWizard } from "@/features/accounts/new-account-wizard";
import { openAccountDetails } from "@/features/accounts/account-details";
import { openNewCardWizard } from "@/features/cards/new-card-wizard";
import { endSession } from "@/features/session/actions";
import { normalize } from "@/lib/text";
import { NAV_ITEMS } from "./nav-items";
import { RELEASE_TYPES, newRelease } from "./quick-add";

interface PaletteProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

/** ⌘K command palette: navigate, create, toggle preferences, jump to accounts and cards. */
export function CommandPalette({ open, onOpenChange }: PaletteProps) {
  const t = useNavT();
  const router = useRouter();
  const qc = useQueryClient();
  const { accounts, cards, ready } = usePicklists();
  const prefs = usePrefs();

  const run = (fn: () => void) => {
    onOpenChange(false);
    setTimeout(fn, 10);
  };
  const itemClass =
    "flex min-h-10 cursor-pointer select-none items-center gap-3 rounded-[var(--radius-sm)] px-2.5 text-sm text-ink outline-none data-[selected=true]:bg-surface-2 data-[disabled=true]:opacity-40 [&>svg]:size-4 [&>svg]:text-ink-3";
  const groupClass =
    "[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-ink-3";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[var(--overlay)] backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-[12vh] z-50 w-[calc(100%-1.5rem)] max-w-[600px] -translate-x-1/2 overflow-hidden rounded-[var(--radius-xl)] border border-line bg-surface shadow-[var(--shadow-lift)] outline-none">
          <Dialog.Title className="sr-only">Comandos</Dialog.Title>
          <Dialog.Description className="sr-only">Busque páginas, ações, contas e cartões.</Dialog.Description>
          <Command loop filter={(value, search, keywords) => (normalize([value, ...(keywords ?? [])].join(" ")).includes(normalize(search)) ? 1 : 0)}>
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search className="size-[18px] text-ink-3" aria-hidden />
              <Command.Input autoFocus placeholder={t("search")} className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-ink-3" />
              <Kbd>Esc</Kbd>
            </div>
            <Command.List className="scrollbar-thin max-h-[60vh] overflow-y-auto p-2">
              <Command.Empty className="py-10 text-center text-sm text-ink-3">Nada encontrado.</Command.Empty>
              <Command.Group heading="Criar" className={groupClass}>
                {RELEASE_TYPES.map((r) => (
                  <Command.Item key={r.type} value={`novo lançamento ${t(r.key)}`} disabled={!ready} onSelect={() => run(() => newRelease(r.type))} className={itemClass}>
                    <r.icon />
                    <span className="flex-1">
                      {t("newRelease")}: {t(r.key)}
                    </span>
                    <Kbd>{r.shortcut}</Kbd>
                  </Command.Item>
                ))}
                <Command.Item value="nova conta bancária" onSelect={() => run(() => openNewAccountWizard())} className={itemClass}>
                  <Plus /> Nova conta
                </Command.Item>
                <Command.Item value="novo cartão de crédito" onSelect={() => run(() => openNewCardWizard())} className={itemClass}>
                  <Plus /> Novo cartão de crédito
                </Command.Item>
              </Command.Group>
              <Command.Group heading="Ir para" className={groupClass}>
                {NAV_ITEMS.flatMap((n) => (n.children ? n.children.map((c) => ({ ...c, icon: n.icon, prefix: `${t(n.key)} · ` })) : [{ ...n, prefix: "" }])).map((n) => (
                  <Command.Item key={n.href} value={`${n.prefix}${t(n.key)}`} onSelect={() => run(() => router.push(n.href))} className={itemClass}>
                    <n.icon />
                    {n.prefix}
                    {t(n.key)}
                  </Command.Item>
                ))}
                <Command.Item value={t("profile")} onSelect={() => run(() => router.push("/meu-perfil"))} className={itemClass}>
                  <User /> {t("profile")}
                </Command.Item>
                <Command.Item value={t("settings")} onSelect={() => run(() => router.push("/configuracoes"))} className={itemClass}>
                  <Settings /> {t("settings")}
                </Command.Item>
              </Command.Group>
              {accounts.some((a) => a.active) && (
                <Command.Group heading="Contas" className={groupClass}>
                  {accounts
                    .filter((a) => a.active)
                    .map((a) => (
                      <Command.Item key={a.id} value={`conta ${a.displayName} ${a.id}`} keywords={[a.institutionName ?? ""]} onSelect={() => run(() => openAccountDetails(a.id))} className={itemClass}>
                        <InstitutionLogo institutionId={a.institutionId} name={a.displayName} size="xs" />
                        {a.displayName}
                        <Landmark className="ml-auto" />
                      </Command.Item>
                    ))}
                </Command.Group>
              )}
              {cards.some((c) => c.active) && (
                <Command.Group heading="Faturas" className={groupClass}>
                  {cards
                    .filter((c) => c.active)
                    .map((c) => (
                      <Command.Item key={c.id} value={`fatura cartão ${c.displayName} ${c.id}`} onSelect={() => run(() => router.push(`/cartoes-de-credito/fatura/${c.id}`))} className={itemClass}>
                        <InstitutionLogo institutionId={c.institutionId} name={c.displayName} size="xs" />
                        Fatura · {c.displayName}
                        <CreditCard className="ml-auto" />
                      </Command.Item>
                    ))}
                </Command.Group>
              )}
              <Command.Group heading="Preferências" className={groupClass}>
                <Command.Item value={prefs.showValues ? t("hideValues") : t("showValues")} onSelect={() => run(() => prefs.set({ showValues: !prefs.showValues }))} className={itemClass}>
                  <Eye />
                  <span className="flex-1">{prefs.showValues ? t("hideValues") : t("showValues")}</span>
                  <Kbd>H</Kbd>
                </Command.Item>
                <Command.Item
                  value="alternar tema claro escuro"
                  onSelect={() => run(() => prefs.setConfigs({ theme: document.documentElement.classList.contains("dark") ? "light" : "dark" }))}
                  className={itemClass}
                >
                  {prefs.theme === "dark" ? <Sun /> : <Moon />} Alternar tema claro/escuro
                </Command.Item>
                <Command.Item
                  value={t("logout")}
                  onSelect={() =>
                    run(async () => {
                      await endSession(qc);
                      router.replace("/login");
                    })
                  }
                  className={itemClass}
                >
                  <LogOut /> {t("logout")}
                </Command.Item>
              </Command.Group>
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
