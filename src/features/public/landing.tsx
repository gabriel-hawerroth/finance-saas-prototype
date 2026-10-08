"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ArrowRight, ArrowUpRight, CalendarRange, ChartPie, Check, CreditCard, Laptop, Lock, PiggyBank, Smartphone } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { useSession } from "@/features/session/store";

const FEATURES = [
  { icon: CalendarRange, title: "O mês inteiro numa linha do tempo", text: "Realizado e previsto lado a lado. Fixos, parcelados, transferências e reembolsos, com filtros instantâneos." },
  { icon: CreditCard, title: "Faturas pelo ciclo real", text: "Fechamento, vencimento, composição e pagamentos. Mude o ciclo e veja o efeito antes de confirmar." },
  { icon: PiggyBank, title: "Cofrinhos com metas", text: "Separe dinheiro dentro da própria conta, acompanhe a meta e resgate quando quiser — sem bagunçar o saldo." },
  { icon: ChartPie, title: "Relatórios que respondem", text: "Para onde vai o dinheiro por categoria, subcategoria e conta, em qualquer período." },
  { icon: Smartphone, title: "Feito para o polegar", text: "No celular, tudo a um toque: lançar, conferir a fatura, marcar como pago." },
  { icon: Lock, title: "Seus dados, sua conta", text: "Valores ocultáveis com um toque e exclusão de conta confirmada por e-mail." },
];

const FAQ = [
  ["O Finax conecta no meu banco?", "Não. Você registra o que importa e o Finax organiza. Sem senhas de banco, sem integrações que você não controla."],
  ["Funciona no computador e no celular?", "Sim. A experiência se adapta a cada tela e pode ser instalada como app."],
  ["Quanto custa?", "Quem entra durante o acesso antecipado garante o plano Básico gratuito para sempre."],
];

function PreviewCard() {
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-[560px] rotate-[-1.5deg] rounded-[28px] border border-white/10 bg-[#16171a] p-6 text-[#f1f0ec] shadow-[0_40px_120px_-40px_rgba(0,0,0,.6)]">
      <p className="text-xs text-[#93958e]">Saldo geral</p>
      <p className="font-display text-6xl leading-none">R$ 24.180,52</p>
      <div className="mt-5 grid grid-cols-3 gap-2 text-xs">
        {[
          ["Receitas", "R$ 9.850", "#52cc8f"],
          ["Despesas", "R$ 6.214", "#ff7c6b"],
          ["Balanço", "R$ 3.636", "#d7f25c"],
        ].map(([l, v, c]) => (
          <div key={l} className="rounded-2xl bg-white/5 p-3">
            <p className="text-[#93958e]">{l}</p>
            <p className="mt-1 text-base font-semibold" style={{ color: c }}>
              {v}
            </p>
          </div>
        ))}
      </div>
      <ul className="mt-5 grid gap-2">
        {[
          ["Supermercado", "Cartão · hoje", "−R$ 312,40"],
          ["Salário", "Conta corrente · dia 5", "+R$ 9.850,00"],
          ["Guardar na reserva", "Cofrinho · 62% da meta", "R$ 600,00"],
        ].map(([t, s, v]) => (
          <li key={t} className="flex items-center justify-between rounded-2xl bg-white/[.04] px-4 py-3">
            <span>
              <span className="block text-sm font-medium">{t}</span>
              <span className="block text-xs text-[#93958e]">{s}</span>
            </span>
            <span className="text-sm font-semibold">{v}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Landing() {
  const router = useRouter();
  const user = useSession((s) => s.user);
  React.useEffect(() => {
    // Installed app (standalone PWA) skips the marketing page.
    if (window.matchMedia("(display-mode: standalone)").matches) router.replace("/login");
  }, [router]);
  const enterHref = user ? "/home" : "/login";

  return (
    <div className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-30 border-b border-transparent bg-[color-mix(in_srgb,var(--bg)_85%,transparent)] backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Logo />
          <nav aria-label="Seções" className="hidden items-center gap-7 text-sm text-ink-2 md:flex">
            <a href="#recursos" className="hover:text-ink">Recursos</a>
            <a href="#precos" className="hover:text-ink">Preços</a>
            <a href="#perguntas" className="hover:text-ink">Perguntas</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href={enterHref} className="h-9 rounded-[var(--radius-md)] px-3 text-sm font-medium leading-9 hover:bg-surface-2">
              Entrar
            </Link>
            <Link href="/nova-conta" className="hidden h-9 items-center gap-1.5 rounded-[var(--radius-md)] bg-primary px-4 text-sm font-medium text-primary-fg sm:inline-flex">
              Começar grátis
            </Link>
          </div>
        </div>
      </header>

      <main id="main">
        <section className="mx-auto grid max-w-6xl items-center gap-14 px-5 pb-20 pt-14 lg:grid-cols-[1.1fr_1fr] lg:pt-24">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <p className="inline-flex items-center gap-2 rounded-full border border-line-strong px-3 py-1 text-xs font-medium text-ink-2">
              <span className="size-1.5 rounded-full bg-brand ring-2 ring-brand/30" /> Acesso antecipado aberto
            </p>
            <h1 className="mt-6 font-display text-[56px] leading-[0.95] tracking-tight sm:text-[84px]">
              Dinheiro claro,
              <br />
              <em className="text-ink-3">decisões calmas.</em>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-ink-2">Contas, cartões, faturas e cofrinhos numa única visão do mês — com o que já aconteceu e o que ainda vem.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/nova-conta" className="inline-flex h-12 items-center gap-2 rounded-[var(--radius-md)] bg-primary px-6 text-[15px] font-medium text-primary-fg hover:opacity-90">
                Começar grátis <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link href="/login" className="inline-flex h-12 items-center rounded-[var(--radius-md)] border border-line-strong px-6 text-[15px] font-medium hover:bg-surface-2">
                Ver a demonstração
              </Link>
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}>
            <PreviewCard />
          </motion.div>
        </section>

        <section id="recursos" className="scroll-mt-20 border-t border-line">
          <div className="mx-auto max-w-6xl px-5 py-20">
            <h2 className="max-w-2xl font-display text-5xl leading-none">Tudo o que o seu mês precisa. Nada que atrapalhe.</h2>
            <ul className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <li key={f.title}>
                  <f.icon className="size-6 text-ink" aria-hidden />
                  <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
                  <p className="mt-2 leading-relaxed text-ink-2">{f.text}</p>
                </li>
              ))}
            </ul>
            <p className="mt-12 flex items-center gap-2 text-sm text-ink-3">
              <Laptop className="size-4" aria-hidden /> Na web e no celular, com tema claro e escuro.
            </p>
          </div>
        </section>

        <section id="precos" className="scroll-mt-20 bg-[#131418] text-[#f6f5f1]">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="font-display text-5xl leading-none">
                Entre agora.
                <br />
                <em className="text-[#d7f25c]">Fique de graça.</em>
              </h2>
              <p className="mt-5 max-w-md text-[#bdbeb8]">Quem se cadastra antes do lançamento garante acesso vitalício gratuito ao plano Básico.</p>
            </div>
            <div className="rounded-[28px] border border-white/10 p-7">
              <p className="text-sm text-[#93958e]">Plano Básico · acesso antecipado</p>
              <p className="mt-2 font-display text-6xl">R$ 0</p>
              <ul className="mt-6 grid gap-2.5 text-[15px]">
                {["Contas, cofrinhos e investimentos ilimitados", "Cartões com faturas por ciclo", "Lançamentos fixos e parcelados", "Relatórios por categoria e conta"].map((i) => (
                  <li key={i} className="flex items-center gap-2.5">
                    <Check className="size-4 text-[#d7f25c]" aria-hidden /> {i}
                  </li>
                ))}
              </ul>
              <Link href="/nova-conta" className="mt-8 inline-flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[#d7f25c] text-[15px] font-medium text-[#14160a] hover:brightness-95">
                Garantir meu acesso <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
          </div>
        </section>

        <section id="perguntas" className="scroll-mt-20">
          <div className="mx-auto max-w-3xl px-5 py-20">
            <h2 className="font-display text-5xl leading-none">Perguntas</h2>
            <div className="mt-10 divide-y divide-line border-y border-line">
              {FAQ.map(([q, a]) => (
                <details key={q} className="group py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between text-lg font-medium">
                    {q}
                    <span className="text-ink-3 transition-transform group-open:rotate-45" aria-hidden>
                      +
                    </span>
                  </summary>
                  <p className="mt-3 leading-relaxed text-ink-2">{a}</p>
                </details>
              ))}
            </div>
            <a href="mailto:suporte@appfinax.com.br?subject=Quero%20conhecer%20o%20Finax" className="mt-10 inline-flex items-center gap-1.5 font-medium underline decoration-line-strong underline-offset-4 hover:decoration-ink">
              Falar com especialista <ArrowUpRight className="size-4" aria-hidden />
            </a>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm text-ink-3">
          <Logo />
          <nav aria-label="Rodapé" className="flex flex-wrap gap-5">
            <a href="mailto:suporte@appfinax.com.br" className="hover:text-ink">suporte@appfinax.com.br</a>
            <Link href="/politica-de-privacidade" className="hover:text-ink">Privacidade</Link>
            <Link href="/termos-de-uso" className="hover:text-ink">Termos</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
