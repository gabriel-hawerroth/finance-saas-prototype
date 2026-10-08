import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Latency = "instant" | "normal" | "slow";

interface NetworkLab {
  latency: Latency;
  failureRate: number;
  offline: boolean;
  set: (patch: Partial<Omit<NetworkLab, "set">>) => void;
}

/** Demo controls for simulated network conditions (Settings → Laboratório). */
export const useNetworkLab = create<NetworkLab>()(
  persist(
    (set) => ({
      latency: "normal",
      failureRate: 0,
      offline: false,
      set: (patch) => set(patch),
    }),
    { name: "finax.lab" },
  ),
);
