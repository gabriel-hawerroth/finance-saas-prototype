"use client";
import * as React from "react";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { canResend, formatCountdown, isExpired, registerResend, remainingAttempts, startResendTimer, type ResendState } from "@/domain/email-resend";
import { storage } from "@/lib/storage";

export type ResendFlow = "activation" | "recovery";

interface Stored extends ResendState {
  email: string;
}

const keyOf = (flow: ResendFlow) => `finax.resend.${flow}`;

/** Persisted resend timer for one flow (§5.10): survives reloads, independent per flow. */
export function useResendTimer(flow: ResendFlow) {
  const [state, setState] = React.useState<Stored | null>(() => storage.get<Stored | null>(keyOf(flow), null));
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const expired = state != null && isExpired(state, now);
  React.useEffect(() => {
    if (expired) storage.remove(keyOf(flow));
  }, [expired, flow]);
  const start = (email: string) => {
    const s = { ...startResendTimer(Date.now()), email };
    storage.set(keyOf(flow), s);
    setState(s);
  };
  const resent = () =>
    setState((s) => {
      if (!s) return s;
      const n = { ...registerResend(s, Date.now()), email: s.email };
      storage.set(keyOf(flow), n);
      return n;
    });
  const reset = () => {
    storage.remove(keyOf(flow));
    setState(null);
  };
  return { state: expired ? null : state, now, start, resent, reset };
}

interface ResendControlsProps {
  timer: ReturnType<typeof useResendTimer>;
  onResend: () => Promise<void>;
}

export function ResendControls({ timer, onResend }: ResendControlsProps) {
  const [sending, setSending] = React.useState(false);
  const { state, now } = timer;
  if (!state) return null;
  const allowed = canResend(state, now);
  const left = remainingAttempts(state);
  return (
    <div className="grid gap-2 rounded-[var(--radius-lg)] border border-line p-4">
      <Button
        variant="secondary"
        disabled={!allowed || sending}
        loading={sending}
        onClick={async () => {
          setSending(true);
          try {
            await onResend();
          } finally {
            setSending(false);
          }
        }}
      >
        {!sending && <RotateCw aria-hidden />}
        {allowed ? "Reenviar e-mail" : left > 0 ? `Reenviar em ${formatCountdown(state.unlockAt - now)}` : `Bloqueado por ${formatCountdown(state.unlockAt - now)}`}
      </Button>
      <p className="text-center text-xs text-ink-3" aria-live="polite">
        {left > 0 ? `${left} ${left === 1 ? "reenvio restante" : "reenvios restantes"}` : "Você atingiu o limite de reenvios. Tente novamente mais tarde."}
      </p>
    </div>
  );
}
