/**
 * C19 — e-mail resend throttling (§5.10). Pure state machine; persistence lives in the caller.
 * After the first send: resend unlocks in 2 min; after the 1st resend: 3 min;
 * after the 2nd resend: blocked for 1 h, then the flow returns to the start.
 */
export interface ResendState {
  resends: number;
  unlockAt: number;
}

export const RESEND_DELAYS_MS = [2 * 60_000, 3 * 60_000, 60 * 60_000] as const;
export const MAX_RESENDS = 2;

export function startResendTimer(now: number): ResendState {
  return { resends: 0, unlockAt: now + RESEND_DELAYS_MS[0] };
}

export function registerResend(state: ResendState, now: number): ResendState {
  const resends = state.resends + 1;
  return { resends, unlockAt: now + RESEND_DELAYS_MS[Math.min(resends, RESEND_DELAYS_MS.length - 1)] };
}

export function canResend(state: ResendState, now: number): boolean {
  return state.resends < MAX_RESENDS && now >= state.unlockAt;
}

/** True once the 1 h block after the last allowed resend has expired. */
export function isExpired(state: ResendState, now: number): boolean {
  return state.resends >= MAX_RESENDS && now >= state.unlockAt;
}

export function remainingAttempts(state: ResendState): number {
  return Math.max(0, MAX_RESENDS - state.resends);
}

/** m:ss below one hour, otherwise "Hh Mm". */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}:${String(s).padStart(2, "0")}`;
}
