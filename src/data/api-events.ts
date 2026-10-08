import type { ApiError } from "@/domain/errors";

type Listener = (error: ApiError) => void;
const listeners = new Set<Listener>();

/** Global transport-error channel (§9.4): 401/403 end the session, 0 = offline, 429 = throttled. */
export function onApiEvent(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitApiEvent(error: ApiError): void {
  for (const l of listeners) l(error);
}
