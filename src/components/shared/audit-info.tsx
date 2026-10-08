"use client";
import { usePrefs } from "@/features/prefs/store";
import { formatDateTime } from "@/lib/dates";

/** "Criado em / Alterado em" — only when the preference is on and a creation date exists (§5.20). */
export function AuditInfo({ createdAt, updatedAt }: { createdAt?: string | null; updatedAt?: string | null }) {
  const show = usePrefs((s) => s.showAuditFields);
  if (!show || !createdAt) return null;
  return (
    <p className="text-xs text-ink-3">
      Criado em {formatDateTime(createdAt)}
      {updatedAt ? ` · Alterado em ${formatDateTime(updatedAt)}` : ""}
    </p>
  );
}
