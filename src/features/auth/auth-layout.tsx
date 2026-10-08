"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo, LogoMark } from "@/components/shared/logo";
import { DemoInboxButton } from "@/features/demo-inbox/inbox";
import { useSession } from "@/features/session/store";
import { useHydrated } from "@/features/session/use-hydrated";

/** Only for signed-out visitors: a session goes straight to /home (§2.1). */
export function GuestOnly({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  const user = useSession((s) => s.user);
  const router = useRouter();
  React.useEffect(() => {
    if (hydrated && user) router.replace("/home");
  }, [hydrated, user, router]);
  if (!hydrated || user) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <LogoMark className="size-10 animate-pulse" />
      </div>
    );
  }
  return <>{children}</>;
}

/** Split layout for authentication screens: editorial brand panel + focused form. */
export function AuthLayout({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <aside className="relative hidden overflow-hidden bg-[#131418] p-12 text-[#f6f5f1] lg:flex lg:flex-col">
        <Link href="/" className="inline-flex items-center gap-2.5" aria-label="Finax — página inicial">
          <svg viewBox="0 0 64 64" className="size-8" aria-hidden>
            <rect width="64" height="64" rx="16" fill="#f6f5f1" />
            <path d="M20 46V18h24" stroke="#131418" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <path d="M20 32h16" stroke="#7a8a20" strokeWidth="6" strokeLinecap="round" />
          </svg>
          <span className="font-display text-[26px]">Finax</span>
        </Link>
        <div className="mt-auto max-w-md">{aside ?? <DefaultAside />}</div>
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-[#d7f25c] opacity-[0.13] blur-3xl" />
      </aside>
      <main id="main" className="flex flex-col px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between lg:justify-end">
          <Link href="/" className="lg:hidden" aria-label="Finax — página inicial">
            <Logo />
          </Link>
          <DemoInboxButton label />
        </div>
        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-10">{children}</div>
        <p className="text-center text-xs text-ink-3">
          <Link href="/termos-de-uso" className="hover:text-ink">
            Termos de uso
          </Link>{" "}
          ·{" "}
          <Link href="/politica-de-privacidade" className="hover:text-ink">
            Privacidade
          </Link>
        </p>
      </main>
    </div>
  );
}

function DefaultAside() {
  return (
    <>
      <p className="font-display text-[44px] leading-[1.05]">
        Dinheiro claro,
        <br />
        <em className="text-[#d7f25c]">decisões calmas.</em>
      </p>
      <p className="mt-5 text-[15px] leading-relaxed text-[#bdbeb8]">Contas, cartões, faturas e o mês inteiro em uma única linha do tempo — com o que já aconteceu e o que ainda vem.</p>
      <dl className="mt-10 grid grid-cols-3 gap-6 border-t border-white/10 pt-6 text-sm">
        <div>
          <dt className="text-[#93958e]">Faturas</dt>
          <dd className="mt-1">por ciclo real</dd>
        </div>
        <div>
          <dt className="text-[#93958e]">Cofrinhos</dt>
          <dd className="mt-1">com metas</dd>
        </div>
        <div>
          <dt className="text-[#93958e]">Previsto</dt>
          <dd className="mt-1">× realizado</dd>
        </div>
      </dl>
    </>
  );
}

export function AuthHeading({ title, description }: { title: React.ReactNode; description?: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h1 className="font-display text-[40px] leading-[1.05]">{title}</h1>
      {description && <p className="mt-2 text-[15px] text-ink-3">{description}</p>}
    </div>
  );
}
