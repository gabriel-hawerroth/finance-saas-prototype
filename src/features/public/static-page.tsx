import Link from "next/link";
import { Logo } from "@/components/shared/logo";

/** Shell for static public pages (legal texts, notices). */
export function StaticPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-6">
        <Link href="/" aria-label="Finax — página inicial">
          <Logo />
        </Link>
        <Link href="/login" className="text-sm font-medium underline decoration-line-strong underline-offset-4 hover:decoration-ink">
          Entrar
        </Link>
      </header>
      <main id="main" className="mx-auto max-w-3xl px-5 pb-20 pt-6">
        {children}
      </main>
    </div>
  );
}

export function Notice({ icon, title, children, action }: { icon: React.ReactNode; title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <StaticPage>
      <div className="grid justify-items-start gap-5 py-16">
        <span className="grid size-14 place-items-center rounded-2xl bg-surface-2 text-ink-2 [&_svg]:size-7" aria-hidden>
          {icon}
        </span>
        <h1 className="font-display text-5xl leading-none">{title}</h1>
        <div className="max-w-xl text-[17px] leading-relaxed text-ink-2">{children}</div>
        {action ?? (
          <Link href="/" className="mt-2 inline-flex h-11 items-center rounded-[var(--radius-md)] bg-primary px-5 text-sm font-medium text-primary-fg">
            Ir para a página inicial
          </Link>
        )}
      </div>
    </StaticPage>
  );
}
