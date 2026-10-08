"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { LogoMark } from "@/components/shared/logo";
import { AppShell } from "@/features/shell/app-shell";
import { useSession } from "@/features/session/store";
import { useHydrated } from "@/features/session/use-hydrated";

/** Authenticated area: requires a local session, otherwise goes to login (§2.1). */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  const user = useSession((s) => s.user);
  const router = useRouter();

  React.useEffect(() => {
    if (hydrated && !user) router.replace("/login");
  }, [hydrated, user, router]);

  if (!hydrated || !user) {
    return (
      <div className="grid min-h-dvh place-items-center" aria-busy="true" aria-label="Carregando">
        <LogoMark className="size-10 animate-pulse" />
      </div>
    );
  }
  return <AppShell>{children}</AppShell>;
}
