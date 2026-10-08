"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Link2Off, Mail, MailCheck, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, describedBy } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { api } from "@/data/api";
import { isApiError } from "@/domain/errors";
import { isPasswordValid } from "@/domain/password";
import { endSession } from "@/features/session/actions";
import { useSession } from "@/features/session/store";
import { useHydrated } from "@/features/session/use-hydrated";
import { DemoInboxButton } from "@/features/demo-inbox/inbox";
import { useIsMobile } from "@/hooks/use-media-query";
import { AuthHeading, AuthLayout, GuestOnly } from "./auth-layout";
import { GoogleButton } from "./google-button";
import { PasswordChecklist } from "./password-checklist";
import { ResendControls, useResendTimer } from "./resend-controls";

function Callout({ icon, title, children, tone = "neutral" }: { icon: React.ReactNode; title: string; children?: React.ReactNode; tone?: "neutral" | "positive" | "negative" }) {
  const toneCls = tone === "positive" ? "bg-positive-soft text-positive" : tone === "negative" ? "bg-negative-soft text-negative" : "bg-surface-2 text-ink-2";
  return (
    <div className="grid gap-4">
      <span className={`grid size-14 place-items-center rounded-2xl [&_svg]:size-7 ${toneCls}`} aria-hidden>
        {icon}
      </span>
      <h1 className="font-display text-[40px] leading-[1.05]">{title}</h1>
      {children && <div className="text-[15px] leading-relaxed text-ink-2">{children}</div>}
    </div>
  );
}

/* ───────────── Register (R6) ───────────── */

const registerSchema = z.object({
  firstName: z.string().trim().min(1, "Informe seu nome.").max(30, "Use no máximo 30 caracteres."),
  lastName: z.string().max(40, "Use no máximo 40 caracteres."),
  email: z.string().min(1, "Informe seu e-mail.").max(255).email("E-mail inválido."),
  password: z.string(),
  useTerms: z.boolean(),
});
type RegisterValues = z.infer<typeof registerSchema>;

export function RegisterView() {
  const timer = useResendTimer("activation");
  const [error, setError] = React.useState<string | null>(null);
  const form = useForm<RegisterValues>({ resolver: zodResolver(registerSchema), defaultValues: { firstName: "", lastName: "", email: "", password: "", useTerms: false } });
  const { register, handleSubmit, formState, watch, setValue } = form;
  const errors = formState.errors;
  const password = watch("password");

  const onSubmit = async (v: RegisterValues) => {
    setError(null);
    // Validation order from the spec: password policy → terms → the rest (handled by the resolver).
    if (!isPasswordValid(v.password)) return setError("Sua senha não atende aos requisitos.");
    if (!v.useTerms) return setError("Você precisa aceitar os termos de uso.");
    try {
      await api.auth.register({ email: v.email.trim(), password: v.password, firstName: v.firstName.trim(), lastName: v.lastName.trim() || null });
      timer.start(v.email.trim());
    } catch (e) {
      const d = isApiError(e) ? e.errorDescription : undefined;
      setError(d === "this email is already in use" ? "Este e-mail já está cadastrado." : d === "invalid email" ? "E-mail inválido." : "Não foi possível criar a conta. Tente novamente.");
    }
  };

  const resend = async () => {
    try {
      await api.auth.resendActivation(timer.state!.email);
      timer.resent();
      toast.success("E-mail de ativação reenviado.");
    } catch (e) {
      if (isApiError(e) && e.errorDescription === "user already active") {
        timer.reset();
        toast.info("Sua conta já está ativa. Faça login.");
      } else if (!(isApiError(e) && e.status === 429)) toast.error("Não foi possível reenviar.");
    }
  };

  return (
    <GuestOnly>
      <AuthLayout>
        {timer.state ? (
          <div className="grid gap-6">
            <Callout icon={<MailCheck />} title="Confira seu e-mail" tone="positive">
              Enviamos um link de ativação para <strong className="font-medium text-ink">{timer.state.email}</strong>. Abra o e-mail e toque em “Ativar minha conta”.
            </Callout>
            <div className="flex items-center gap-2 rounded-[var(--radius-lg)] bg-brand-soft px-4 py-3 text-sm text-ink-2">
              <Mail className="size-4 shrink-0 text-brand-ink" aria-hidden />
              <span className="flex-1">Este protótipo não envia e-mails reais. Use a caixa de entrada simulada.</span>
              <DemoInboxButton label />
            </div>
            <ResendControls timer={timer} onResend={resend} />
            <p className="text-center text-sm text-ink-3">
              Já ativou?{" "}
              <Link href="/login" className="font-medium text-ink underline decoration-line-strong underline-offset-4">
                Fazer login
              </Link>
            </p>
          </div>
        ) : (
          <>
            <AuthHeading title="Criar conta" description="Leva menos de um minuto." />
            <form noValidate onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
              {error && (
                <p role="alert" className="rounded-[var(--radius-md)] bg-negative-soft px-3 py-2.5 text-sm text-negative">
                  {error}
                </p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nome" htmlFor="rg-first" error={errors.firstName?.message}>
                  <Input id="rg-first" autoComplete="given-name" maxLength={30} aria-invalid={Boolean(errors.firstName)} aria-describedby={describedBy("rg-first", errors.firstName)} {...register("firstName")} />
                </Field>
                <Field label="Sobrenome" htmlFor="rg-last" optional error={errors.lastName?.message}>
                  <Input id="rg-last" autoComplete="family-name" maxLength={40} {...register("lastName")} />
                </Field>
              </div>
              <Field label="E-mail" htmlFor="rg-email" error={errors.email?.message}>
                <Input id="rg-email" type="email" autoComplete="email" maxLength={255} aria-invalid={Boolean(errors.email)} aria-describedby={describedBy("rg-email", errors.email)} {...register("email")} />
              </Field>
              <Field label="Senha" htmlFor="rg-pass">
                <PasswordInput id="rg-pass" autoComplete="new-password" {...register("password")} />
              </Field>
              <PasswordChecklist value={password} />
              <label className="flex items-start gap-2.5 text-sm text-ink-2">
                <Checkbox className="mt-0.5" checked={watch("useTerms")} onCheckedChange={(c) => setValue("useTerms", c === true)} />
                <span>
                  Li e aceito os{" "}
                  <Link href="/termos-de-uso" className="font-medium text-ink underline decoration-line-strong underline-offset-4">
                    termos de uso
                  </Link>
                  .
                </span>
              </label>
              <Button type="submit" variant="primary" size="lg" className="mt-2 w-full" loading={formState.isSubmitting}>
                Criar conta
              </Button>
            </form>
            <div className="my-6 flex items-center gap-3 text-xs text-ink-3">
              <span className="h-px flex-1 bg-line" /> ou <span className="h-px flex-1 bg-line" />
            </div>
            <GoogleButton label="Cadastrar com Google" />
            <p className="mt-8 text-center text-sm text-ink-3">
              Já tem conta?{" "}
              <Link href="/login" className="font-medium text-ink underline decoration-line-strong underline-offset-4">
                Entrar
              </Link>
            </p>
          </>
        )}
      </AuthLayout>
    </GuestOnly>
  );
}

/* ───────────── Activation (R7) ───────────── */

export function ActivationView() {
  const search = useSearchParams();
  const router = useRouter();
  const isMobile = useIsMobile();
  const [state, setState] = React.useState<"working" | "ok">("working");
  const ran = React.useRef(false);
  React.useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const token = search.get("token");
    // Mock of the backend redirect that activates the account when the e-mail link is opened.
    void (async () => {
      const result = token ? await api.auth.activate(token).catch(() => "error" as const) : "ok";
      if (result === "expired") return router.replace("/link-expirado");
      if (result === "error") return router.replace("/erro-ativacao");
      window.history.replaceState(null, "", "/ativacao-da-conta");
      for (const k of ["finax.resend.activation", "finax.resend.recovery"]) window.localStorage.removeItem(k);
      setState("ok");
      if (isMobile) toast.success("Conta ativada! Faça login para começar.", { duration: Infinity, action: { label: "OK", onClick: () => {} } });
    })();
  }, [search, router, isMobile]);

  return (
    <GuestOnly>
      <AuthLayout>
        {state === "working" ? (
          <p role="status" className="text-ink-3">
            Ativando sua conta…
          </p>
        ) : (
          <div className="grid gap-6">
            <Callout icon={<CheckCircle2 />} title="Conta ativada" tone="positive">
              Tudo certo! Agora é só entrar com seu e-mail e senha.
            </Callout>
            <Button asChild variant="primary" size="lg">
              <Link href="/login">Fazer login</Link>
            </Button>
          </div>
        )}
      </AuthLayout>
    </GuestOnly>
  );
}

/* ───────────── Forgot password (R8) ───────────── */

export function ForgotPasswordView() {
  const timer = useResendTimer("recovery");
  const [email, setEmail] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 255;

  const request = async (target: string, isResend: boolean) => {
    try {
      await api.auth.requestRecovery(target);
      if (isResend) {
        timer.resent();
        toast.success("E-mail reenviado.");
      } else timer.start(target);
    } catch (e) {
      if (!(isApiError(e) && e.status === 429)) toast.error("Não foi possível enviar o e-mail. Tente novamente.");
    }
  };

  return (
    <GuestOnly>
      <AuthLayout>
        {timer.state ? (
          <div className="grid gap-6">
            <Callout icon={<MailCheck />} title="Verifique seu e-mail" tone="positive">
              Se existir uma conta com <strong className="font-medium text-ink">{timer.state.email}</strong>, você receberá um link para criar uma nova senha. O link vale por 1 hora.
            </Callout>
            <div className="flex items-center gap-2 rounded-[var(--radius-lg)] bg-brand-soft px-4 py-3 text-sm text-ink-2">
              <Mail className="size-4 shrink-0 text-brand-ink" aria-hidden />
              <span className="flex-1">O e-mail chega na caixa de entrada simulada.</span>
              <DemoInboxButton label />
            </div>
            <ResendControls timer={timer} onResend={() => request(timer.state!.email, true)} />
            <Link href="/login" className="text-center text-sm font-medium underline decoration-line-strong underline-offset-4">
              Voltar ao login
            </Link>
          </div>
        ) : (
          <>
            <AuthHeading title="Esqueci minha senha" description="Informe seu e-mail e enviaremos um link para criar uma nova senha." />
            <form
              noValidate
              className="grid gap-4"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!valid) return;
                setSending(true);
                await request(email.trim(), false);
                setSending(false);
              }}
            >
              <Field label="E-mail" htmlFor="fp-email">
                <Input id="fp-email" type="email" autoComplete="email" maxLength={255} value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
              </Field>
              <Button type="submit" variant="primary" size="lg" disabled={!valid} loading={sending}>
                Enviar link
              </Button>
              <Link href="/login" className="text-center text-sm text-ink-3 hover:text-ink">
                Lembrei a senha
              </Link>
            </form>
          </>
        )}
      </AuthLayout>
    </GuestOnly>
  );
}

/* ───────────── Password recovery (R9) ───────────── */

export function RecoveryView() {
  const search = useSearchParams();
  const router = useRouter();
  const [phase, setPhase] = React.useState<"validating" | "valid" | "invalid">(() => (search.get("rt") ? "validating" : "invalid"));
  const token = React.useRef<string | null>(null);
  const [password, setPassword] = React.useState("");
  const [confirmPw, setConfirmPw] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (token.current !== null) return;
    const rt = search.get("rt");
    token.current = rt ?? "";
    if (!rt) return;
    window.history.replaceState(null, "", "/recuperacao-da-senha"); // keep the token out of the visible URL
    api.auth
      .validateRecovery(rt)
      .then(() => setPhase("valid"))
      .catch(() => setPhase("invalid"));
  }, [search]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!isPasswordValid(password)) return setError("A senha não atende aos requisitos.");
    if (password !== confirmPw) return setError("As senhas não conferem.");
    setSaving(true);
    try {
      await api.auth.confirmRecovery(token.current!, password);
      for (const k of ["finax.resend.activation", "finax.resend.recovery"]) window.localStorage.removeItem(k);
      toast.success("Senha alterada. Entre com a nova senha.");
      router.replace("/login");
    } catch (err) {
      if (isApiError(err) && err.status === 400) setError("A senha não atende aos requisitos.");
      else if (isApiError(err) && err.status === 410) setPhase("invalid");
      else setError("Não foi possível alterar a senha.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <GuestOnly>
      <AuthLayout>
        {phase === "validating" && (
          <p role="status" className="text-ink-3">
            Validando link…
          </p>
        )}
        {phase === "invalid" && (
          <div className="grid gap-6">
            <Callout icon={<Link2Off />} title="Link expirado" tone="negative">
              Este link é inválido, já foi usado ou expirou. Peça um novo para redefinir sua senha.
            </Callout>
            <Button asChild variant="primary" size="lg">
              <Link href="/esqueci-minha-senha">Solicitar novo link</Link>
            </Button>
          </div>
        )}
        {phase === "valid" && (
          <>
            <AuthHeading title="Nova senha" description="Escolha uma senha forte que você não use em outros lugares." />
            <form noValidate onSubmit={submit} className="grid gap-4">
              {error && (
                <p role="alert" className="rounded-[var(--radius-md)] bg-negative-soft px-3 py-2.5 text-sm text-negative">
                  {error}
                </p>
              )}
              <Field label="Nova senha" htmlFor="rc-pass">
                <PasswordInput id="rc-pass" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
              </Field>
              <PasswordChecklist value={password} />
              <Field label="Confirmar senha" htmlFor="rc-confirm">
                <PasswordInput id="rc-confirm" autoComplete="new-password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
              </Field>
              <Button type="submit" variant="primary" size="lg" loading={saving}>
                Salvar nova senha
              </Button>
            </form>
          </>
        )}
      </AuthLayout>
    </GuestOnly>
  );
}

/* ───────────── Account cancellation (R10, no guard) ───────────── */

export function CancelAccountView() {
  const search = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const hydrated = useHydrated();
  const user = useSession((s) => s.user);
  const [phase, setPhase] = React.useState<"confirm" | "canceling" | "success" | "invalid">(() => (search.get("t") ? "confirm" : "invalid"));
  const token = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (token.current !== null) return;
    const t = search.get("t");
    token.current = t ?? "";
    if (t) window.history.replaceState(null, "", "/cancelamento-da-conta");
  }, [search]);

  // Nothing happens on open: deletion only on an explicit click (protects against link scanners).
  const cancel = async () => {
    setPhase("canceling");
    try {
      await api.auth.cancelUser(token.current!);
      if (user) await endSession(qc, { callApi: false });
      setPhase("success");
    } catch (e) {
      if (isApiError(e) && e.status === 410) setPhase("invalid");
      else {
        toast.error("Não foi possível cancelar a conta. Tente novamente.");
        setPhase("confirm");
      }
    }
  };

  if (!hydrated) return null;
  return (
    <AuthLayout>
      {(phase === "confirm" || phase === "canceling") && (
        <div className="grid gap-6">
          <Callout icon={<AlertTriangle />} title="Cancelar sua conta?" tone="negative">
            Esta ação é <strong className="font-medium text-ink">irreversível</strong>. Você perderá:
            <ul className="mt-3 grid list-disc gap-1 pl-5">
              <li>sua assinatura e o acesso ao Finax;</li>
              <li>todos os dados: contas, cartões, categorias e lançamentos;</li>
              <li>todo o histórico e relatórios.</li>
            </ul>
          </Callout>
          <div className="grid gap-2">
            <Button variant="danger" size="lg" onClick={cancel} loading={phase === "canceling"}>
              Confirmar cancelamento
            </Button>
            <Button size="lg" onClick={() => router.replace(user ? "/home" : "/")}>
              Manter minha conta
            </Button>
          </div>
        </div>
      )}
      {phase === "success" && (
        <div className="grid gap-6">
          <Callout icon={<CheckCircle2 />} title="Conta cancelada" tone="positive">
            Seus dados foram excluídos. Obrigado por ter usado o Finax.
          </Callout>
          <Button asChild variant="primary" size="lg">
            <Link href="/">Voltar à página inicial</Link>
          </Button>
        </div>
      )}
      {phase === "invalid" && (
        <div className="grid gap-6">
          <Callout icon={<ShieldX />} title="Link inválido" tone="negative">
            Este link de cancelamento é inválido ou expirou.
          </Callout>
          <Button asChild variant="primary" size="lg">
            <Link href={user ? "/meu-perfil" : "/login"}>{user ? "Ir para o meu perfil" : "Fazer login"}</Link>
          </Button>
        </div>
      )}
    </AuthLayout>
  );
}
