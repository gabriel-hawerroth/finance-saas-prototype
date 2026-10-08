"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, describedBy } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { api } from "@/data/api";
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/data/server/seed";
import { isApiError } from "@/domain/errors";
import { completeLogin } from "@/features/session/actions";
import { useSession } from "@/features/session/store";
import { AuthHeading, AuthLayout, GuestOnly } from "./auth-layout";
import { GoogleButton } from "./google-button";

const schema = z.object({
  email: z.string().min(1, "Informe seu e-mail.").max(255).email("E-mail inválido."),
  password: z.string().min(1, "Informe sua senha."),
  rememberMe: z.boolean(),
});
type Values = z.infer<typeof schema>;

const LOGIN_ERRORS: Record<string, string> = {
  "inactive user": "Sua conta ainda não foi ativada. Confira o e-mail de ativação.",
  "bad credentials": "E-mail ou senha incorretos.",
  "use google to sign in": "Esta conta usa o Google. Entre com o botão do Google.",
  "google account does not match the registered account": "A conta Google não corresponde à conta cadastrada.",
};

export function LoginView() {
  const qc = useQueryClient();
  const router = useRouter();
  const remembered = useSession((s) => s.rememberedEmail);
  const setRemembered = useSession((s) => s.setRememberedEmail);
  const [formError, setFormError] = React.useState<string | null>(null);
  const { register, handleSubmit, formState, setValue, watch } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: remembered ?? "", password: "", rememberMe: true },
  });
  const errors = formState.errors;

  const onSubmit = async (v: Values) => {
    setFormError(null);
    try {
      const user = await api.auth.login(v.email.trim(), v.password);
      setRemembered(v.rememberMe ? v.email.trim() : null);
      await completeLogin(qc, user);
      toast.success(`Que bom te ver, ${user.firstName}!`);
      router.replace("/home");
    } catch (error) {
      const msg = isApiError(error) && error.errorDescription ? LOGIN_ERRORS[error.errorDescription] : undefined;
      setFormError(msg ?? "Servidor indisponível no momento. Tente mais tarde.");
    }
  };

  return (
    <GuestOnly>
      <AuthLayout>
        <AuthHeading title="Entrar" description="Acesse seu painel financeiro." />

        <button
          type="button"
          onClick={() => {
            setValue("email", DEMO_EMAIL);
            setValue("password", DEMO_PASSWORD);
          }}
          className="mb-6 flex w-full items-center gap-3 rounded-[var(--radius-lg)] border border-dashed border-line-strong bg-brand-soft/60 px-4 py-3 text-left transition-colors hover:bg-brand-soft"
        >
          <Sparkles className="size-5 shrink-0 text-brand-ink" aria-hidden />
          <span className="text-sm">
            <span className="block font-medium">Usar conta de demonstração</span>
            <span className="block text-ink-3">
              {DEMO_EMAIL} · {DEMO_PASSWORD}
            </span>
          </span>
        </button>

        <form noValidate onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
          {formError && (
            <p role="alert" className="rounded-[var(--radius-md)] bg-negative-soft px-3 py-2.5 text-sm text-negative">
              {formError}
            </p>
          )}
          <Field label="E-mail" htmlFor="email" error={errors.email?.message}>
            <Input id="email" type="email" autoComplete="email" inputMode="email" maxLength={255} aria-invalid={Boolean(errors.email)} aria-describedby={describedBy("email", errors.email)} {...register("email")} />
          </Field>
          <Field label="Senha" htmlFor="password" error={errors.password?.message}>
            <PasswordInput id="password" autoComplete="current-password" aria-invalid={Boolean(errors.password)} aria-describedby={describedBy("password", errors.password)} {...register("password")} />
          </Field>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-ink-2">
              <Checkbox checked={watch("rememberMe")} onCheckedChange={(c) => setValue("rememberMe", c === true)} />
              Lembrar meu e-mail
            </label>
            <Link href="/esqueci-minha-senha" className="text-sm font-medium underline decoration-line-strong underline-offset-4 hover:decoration-ink">
              Esqueci minha senha
            </Link>
          </div>
          <Button type="submit" variant="primary" size="lg" className="mt-2 w-full" loading={formState.isSubmitting}>
            Entrar
          </Button>
        </form>

        <div className="my-6 flex items-center gap-3 text-xs text-ink-3">
          <span className="h-px flex-1 bg-line" /> ou <span className="h-px flex-1 bg-line" />
        </div>
        <GoogleButton />
        <p className="mt-8 text-center text-sm text-ink-3">
          Não tem conta?{" "}
          <Link href="/nova-conta" className="font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
            Criar uma
          </Link>
        </p>
      </AuthLayout>
    </GuestOnly>
  );
}
