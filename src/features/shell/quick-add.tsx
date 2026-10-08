"use client";
import * as React from "react";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { Modal } from "@/components/ui/modal";
import type { ReleaseType } from "@/domain/types";
import { useNavT } from "@/features/i18n/nav";
import { openOverlay } from "@/features/overlays/store";
import { usePicklists } from "@/features/picklists/queries";
import { openReleaseForm } from "@/features/releases/release-form";
import { cn } from "@/lib/utils";

export const RELEASE_TYPES: { type: ReleaseType; key: "expense" | "revenue" | "transfer"; icon: React.ElementType; tone: string; shortcut: string }[] = [
  { type: "E", key: "expense", icon: ArrowUpRight, tone: "bg-negative-soft text-negative", shortcut: "D" },
  { type: "R", key: "revenue", icon: ArrowDownLeft, tone: "bg-positive-soft text-positive", shortcut: "R" },
  { type: "T", key: "transfer", icon: ArrowLeftRight, tone: "bg-transfer-soft text-transfer", shortcut: "T" },
];

export function newRelease(type: ReleaseType) {
  openReleaseForm({ mode: "new", type });
}

/** Desktop "Novo lançamento" — disabled until the session pick lists are loaded (§5.1). */
export function QuickAddMenu({ collapsed }: { collapsed?: boolean }) {
  const t = useNavT();
  const { ready } = usePicklists();
  return (
    <Menu>
      <MenuTrigger asChild disabled={!ready}>
        <Button variant="primary" className={cn("w-full justify-start", collapsed && "justify-center px-0")} aria-label={t("newRelease")} title={!ready ? "Carregando contas e categorias…" : undefined}>
          <Plus aria-hidden />
          {!collapsed && <span>{t("newRelease")}</span>}
        </Button>
      </MenuTrigger>
      <MenuContent align="start" className="w-60">
        {RELEASE_TYPES.map((r) => (
          <MenuItem key={r.type} onSelect={() => newRelease(r.type)} className="py-1.5">
            <span className={cn("grid size-7 place-items-center rounded-full [&_svg]:!text-current", r.tone)}>
              <r.icon aria-hidden />
            </span>
            <span className="flex-1">{t(r.key)}</span>
            <Kbd>{r.shortcut}</Kbd>
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  );
}

/** Mobile centre "+" — opens a bottom sheet with the three release types. */
export function MobileQuickAdd() {
  const t = useNavT();
  const { ready } = usePicklists();
  const open = () =>
    openOverlay((close) => (
      <Modal open onOpenChange={(o) => !o && close()} title={t("newRelease")} size="sm">
        <div className="grid gap-2 pb-2">
          {RELEASE_TYPES.map((r) => (
            <button
              key={r.type}
              type="button"
              onClick={() => {
                close();
                newRelease(r.type);
              }}
              className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-line px-4 py-3.5 text-left active:bg-surface-2"
            >
              <span className={cn("grid size-10 place-items-center rounded-full", r.tone)}>
                <r.icon className="size-5" aria-hidden />
              </span>
              <span className="text-base font-medium">{t(r.key)}</span>
            </button>
          ))}
        </div>
      </Modal>
    ));
  return (
    <button
      type="button"
      onClick={open}
      disabled={!ready}
      aria-label={t("newRelease")}
      className="-mt-5 grid size-14 place-items-center rounded-full bg-primary text-primary-fg shadow-[var(--shadow-lift)] transition-transform active:scale-95 disabled:opacity-50"
    >
      <Plus className="size-6" aria-hidden />
    </button>
  );
}
