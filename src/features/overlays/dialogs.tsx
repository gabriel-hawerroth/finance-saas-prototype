"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Modal, ModalActions } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import type { SeriesScope } from "@/domain/types";
import { ask } from "./store";

interface ConfirmOptions {
  title?: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
}

/** Generic confirmation (§5.19): "Confirmação", message, Cancelar / Confirmar. */
export function confirm({ title = "Confirmação", message, confirmLabel = "Confirmar", cancelLabel = "Cancelar", tone = "default" }: ConfirmOptions): Promise<boolean> {
  return ask<boolean>((answer) => (
    <Modal
      open
      onOpenChange={(o) => !o && answer(null)}
      title={title}
      size="sm"
      footer={
        <ModalActions>
          <Button onClick={() => answer(null)}>{cancelLabel}</Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} onClick={() => answer(true)} autoFocus>
            {confirmLabel}
          </Button>
        </ModalActions>
      }
    >
      <div className="text-[15px] leading-relaxed text-ink-2">{message}</div>
    </Modal>
  )).then((v) => v === true);
}

export interface Choice<T> {
  value: T;
  label: string;
  description?: React.ReactNode;
  tone?: "default" | "danger" | "primary";
}

/** Pick one of a few actions, presented as large buttons (no hidden radio state). */
export function choose<T>(opts: { title: string; message?: React.ReactNode; choices: Choice<T>[]; cancelLabel?: string }): Promise<T | null> {
  return ask<T>((answer) => (
    <Modal open onOpenChange={(o) => !o && answer(null)} title={opts.title} size="sm" footer={<ModalActions><Button onClick={() => answer(null)}>{opts.cancelLabel ?? "Cancelar"}</Button></ModalActions>}>
      {opts.message && <div className="mb-4 text-[15px] leading-relaxed text-ink-2">{opts.message}</div>}
      <div className="grid gap-2">
        {opts.choices.map((c, i) => (
          <button
            key={i}
            type="button"
            onClick={() => answer(c.value)}
            className={cn(
              "rounded-[var(--radius-lg)] border border-line px-4 py-3 text-left transition-colors hover:border-ink-3 hover:bg-surface-2",
              c.tone === "danger" && "hover:border-negative",
              c.tone === "primary" && "border-ink",
            )}
          >
            <span className={cn("block text-sm font-medium", c.tone === "danger" ? "text-negative" : "text-ink")}>{c.label}</span>
            {c.description && <span className="mt-0.5 block text-[13px] text-ink-3">{c.description}</span>}
          </button>
        ))}
      </div>
    </Modal>
  ));
}

/** Series scope (§5.19): only this / this and next / all. */
export function chooseSeriesScope(action: "edit" | "delete"): Promise<SeriesScope | null> {
  const verb = action === "edit" ? "Editar" : "Excluir";
  return choose<SeriesScope>({
    title: action === "edit" ? "Editar lançamento repetido" : "Excluir lançamento repetido",
    message: "Este lançamento faz parte de uma série. O que você quer alterar?",
    choices: [
      { value: "JUST_THIS", label: `${verb} só este`, tone: action === "delete" ? "danger" : "default" },
      { value: "NEXTS", label: `${verb} este e os próximos`, tone: action === "delete" ? "danger" : "default" },
      { value: "ALL", label: `${verb} todos`, description: "Inclui os lançamentos anteriores da série.", tone: action === "delete" ? "danger" : "default" },
    ],
  });
}
