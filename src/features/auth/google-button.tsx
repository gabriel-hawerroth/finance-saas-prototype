"use client";
import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal, ModalActions } from "@/components/ui/modal";
import { api } from "@/data/api";
import { isApiError } from "@/domain/errors";
import { completeLogin } from "@/features/session/actions";

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.3 12 2.3 6.6 2.3 2.3 6.6 2.3 12s4.3 9.7 9.7 9.7c5.6 0 9.3-3.9 9.3-9.5 0-.6-.1-1.1-.2-1.6H12z" />
    </svg>
  );
}

/**
 * Simulated "Sign in with Google" (no external integration): a local account
 * chooser stands in for Google's consent screen.
 */
export function GoogleButton({ label = "Continuar com Google" }: { label?: string }) {
  const [open, setOpen] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [name, setName] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const qc = useQueryClient();
  const router = useRouter();

  const signIn = async (e: string, n: string) => {
    setLoading(true);
    try {
      const user = await api.auth.google(e, n);
      await completeLogin(qc, user);
      toast.success(`Bem-vindo(a), ${user.firstName}!`);
      router.replace("/home");
    } catch (error) {
      if (isApiError(error) && error.errorDescription === "google account does not match the registered account") toast.error("Esta conta Google não corresponde à conta cadastrada.");
      else toast.error("Não foi possível entrar com Google.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button size="lg" className="w-full" onClick={() => setOpen(true)}>
        <GoogleGlyph />
        {label}
      </Button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Escolha uma conta"
        description="Simulação do Google — nenhum dado sai do seu navegador."
        size="sm"
        footer={
          <ModalActions>
            <Button onClick={() => setOpen(false)}>Cancelar</Button>
            <Button variant="primary" disabled={!/^\S+@\S+\.\S+$/.test(email) || !name.trim()} loading={loading} onClick={() => signIn(email.trim(), name.trim())}>
              Continuar
            </Button>
          </ModalActions>
        }
      >
        <div className="grid gap-4">
          <Field label="Nome" htmlFor="g-name">
            <Input id="g-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" autoComplete="name" />
          </Field>
          <Field label="E-mail do Google" htmlFor="g-email">
            <Input id="g-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@gmail.com" autoComplete="email" />
          </Field>
        </div>
      </Modal>
    </>
  );
}
