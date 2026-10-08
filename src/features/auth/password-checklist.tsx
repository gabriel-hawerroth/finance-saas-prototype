"use client";
import { Check, Circle } from "lucide-react";
import { checkPassword } from "@/domain/password";
import { cn } from "@/lib/utils";

/** Live password policy checklist (C20). */
export function PasswordChecklist({ value }: { value: string }) {
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-1" aria-label="Requisitos da senha">
      {checkPassword(value).map((c) => (
        <li key={c.key} className={cn("flex items-center gap-1.5 text-xs", c.ok ? "text-positive" : "text-ink-3")}>
          {c.ok ? <Check className="size-3.5" aria-hidden /> : <Circle className="size-3" aria-hidden />}
          {c.label}
          <span className="sr-only">{c.ok ? "(atendido)" : "(pendente)"}</span>
        </li>
      ))}
    </ul>
  );
}
