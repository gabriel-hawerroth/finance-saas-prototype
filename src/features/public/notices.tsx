"use client";
import * as React from "react";
import { Unplug } from "lucide-react";
import { format } from "date-fns";
import { Notice } from "./static-page";

let cachedEta: string | null = null;
const etaSnapshot = () => (cachedEta ??= format(new Date(Date.now() + 3 * 3600_000), "dd/MM 'às' HH:mm"));
const noopSubscribe = () => () => {};

/** "/fora-do-ar". The expected return time is illustrative (now + 3 h), as in the reference app. */
export function OutageNotice() {
  const eta = React.useSyncExternalStore(noopSubscribe, etaSnapshot, () => null);
  return (
    <Notice icon={<Unplug />} title="Sistema fora do ar">
      Estamos fazendo uma manutenção. Seus dados estão seguros.
      {eta && <span className="mt-2 block text-ink-3">Previsão de retorno: {eta}.</span>}
    </Notice>
  );
}
