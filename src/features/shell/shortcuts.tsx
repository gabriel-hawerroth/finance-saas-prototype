"use client";
import * as React from "react";
import { Kbd } from "@/components/ui/kbd";
import { Modal } from "@/components/ui/modal";
import { openOverlay, useOverlayStore } from "@/features/overlays/store";
import { usePicklists } from "@/features/picklists/queries";
import { usePrefs } from "@/features/prefs/store";
import { newRelease } from "./quick-add";

function isTyping(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.getAttribute("role") === "combobox";
}

const SHORTCUTS: [string, string][] = [
  ["⌘ K / Ctrl K", "Abrir comandos"],
  ["D", "Nova despesa"],
  ["R", "Nova receita"],
  ["T", "Nova transferência"],
  ["H", "Ocultar / mostrar valores"],
  ["← →", "Mês anterior / próximo (fluxo e fatura)"],
  ["/", "Buscar no fluxo de caixa"],
  ["?", "Mostrar atalhos"],
];

export function openShortcutsHelp() {
  openOverlay((close) => (
    <Modal open onOpenChange={(o) => !o && close()} title="Atalhos de teclado" size="sm">
      <dl className="grid gap-2 pb-2">
        {SHORTCUTS.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-4 text-sm">
            <dt className="text-ink-2">{v}</dt>
            <dd>
              <Kbd className="px-1.5">{k}</Kbd>
            </dd>
          </div>
        ))}
      </dl>
    </Modal>
  ));
}

/** Global single-key shortcuts; ignored while typing or when a dialog is open. */
export function useGlobalShortcuts(openPalette: () => void) {
  const { ready } = usePicklists();
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openPalette();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e)) return;
      if (useOverlayStore.getState().entries.length > 0 || document.querySelector("[role=dialog]")) return;
      const k = e.key.toLowerCase();
      if (k === "d" && ready) newRelease("E");
      else if (k === "r" && ready) newRelease("R");
      else if (k === "t" && ready) newRelease("T");
      else if (k === "h") usePrefs.getState().set({ showValues: !usePrefs.getState().showValues });
      else if (e.key === "?") openShortcutsHelp();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openPalette, ready]);
}

export { isTyping };
