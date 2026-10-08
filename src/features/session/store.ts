"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@/domain/types";

interface SessionState {
  user: User | null;
  /** Remembered login e-mail only — passwords are never stored (§4.2 ATENÇÃO). */
  rememberedEmail: string | null;
  setUser: (user: User | null) => void;
  setRememberedEmail: (email: string | null) => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      user: null,
      rememberedEmail: null,
      setUser: (user) => set({ user }),
      setRememberedEmail: (rememberedEmail) => set({ rememberedEmail }),
    }),
    { name: "finax.user" },
  ),
);
