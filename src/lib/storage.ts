/** localStorage wrapper that never throws (private mode, SSR, quota). */
export const storage = {
  get<T>(key: string, fallback: T): T {
    if (typeof window === "undefined") return fallback;
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  },
  set<T>(key: string, value: T): void {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore quota / privacy errors */
    }
  },
  remove(key: string): void {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

/** Keys cleared on logout (§8.7). */
export const SESSION_KEYS = [
  "finax.session",
  "finax.cashflow.month",
  "finax.report.category",
  "finax.report.account",
  "finax.report.balance",
] as const;
