"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera, ChevronRight, KeyRound, LogOut, Settings, ShieldAlert, Tags } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal, ModalActions } from "@/components/ui/modal";
import { PasswordInput } from "@/components/ui/password-input";
import { Money } from "@/components/shared/money";
import { PageHeader, Panel, PanelHeader } from "@/components/shared/page-header";
import { api } from "@/data/api";
import { qk } from "@/data/query-keys";
import { PROFILE_IMAGE_EXTENSIONS } from "@/domain/constants";
import { isApiError } from "@/domain/errors";
import { isPasswordValid } from "@/domain/password";
import { openOverlay } from "@/features/overlays/store";
import { PasswordChecklist } from "@/features/auth/password-checklist";
import { endSession } from "@/features/session/actions";
import { UserAvatar, useProfileImage } from "@/features/session/avatar";
import { useSession } from "@/features/session/store";
import { readAttachment } from "@/lib/files";

export function ProfileView() {
  const qc = useQueryClient();
  const router = useRouter();
  const user = useSession((s) => s.user)!;
  const setUser = useSession((s) => s.setUser);
  const image = useProfileImage();
  const [firstName, setFirstName] = React.useState(user.firstName);
  const [lastName, setLastName] = React.useState(user.lastName ?? "");
  const [photo, setPhoto] = React.useState<string | null>(null);
  const [photoError, setPhotoError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [slow, setSlow] = React.useState(false);

  const errors = {
    firstName: !firstName.trim() ? "Informe seu nome." : firstName.length > 30 ? "Use no máximo 30 caracteres." : undefined,
    lastName: lastName.length > 90 ? "Use no máximo 90 caracteres." : undefined,
  };
  const dirty = firstName !== user.firstName || lastName !== (user.lastName ?? "") || photo != null;
  const valid = !errors.firstName && !errors.lastName;

  const save = async () => {
    setSaving(true);
    const timer = photo ? setTimeout(() => setSlow(true), 8000) : null;
    try {
      const updated = await api.user.update({ firstName: firstName.trim(), lastName: lastName.trim() || null });
      setUser(updated);
      if (photo) {
        try {
          await api.user.setProfileImage(photo);
          await qc.invalidateQueries({ queryKey: qk.profileImage });
          setPhoto(null);
        } catch {
          toast.warning("Dados salvos, mas a foto não pôde ser atualizada.");
          return;
        }
      }
      toast.success("Perfil atualizado");
    } catch {
      toast.error("Não foi possível salvar o perfil.");
    } finally {
      if (timer) clearTimeout(timer);
      setSlow(false);
      setSaving(false);
    }
  };

  const requestCancel = () =>
    openOverlay((close) => (
      <Modal
        open
        onOpenChange={(o) => !o && close()}
        title="Cancelar conta"
        size="sm"
        footer={
          <ModalActions>
            <Button onClick={close}>Manter conta</Button>
            <Button
              variant="danger"
              onClick={async () => {
                try {
                  await api.auth.sendCancelEmail();
                  toast.success("Enviamos um e-mail com o link de confirmação.", { description: "Abra a caixa de entrada simulada (ícone de envelope)." });
                  close();
                } catch (e) {
                  if (!(isApiError(e) && e.status === 429)) toast.error("Não foi possível enviar o e-mail.");
                }
              }}
            >
              Enviar e-mail de confirmação
            </Button>
          </ModalActions>
        }
      >
        <p className="text-[15px] leading-relaxed text-ink-2">Por segurança, o cancelamento é confirmado por um link enviado ao seu e-mail. Ao confirmar, todos os seus dados, histórico e assinatura são excluídos de forma permanente.</p>
      </Modal>
    ));

  return (
    <div className="mx-auto grid max-w-3xl gap-7">
      <PageHeader eyebrow="Conta" title="Meu perfil" />

      <Panel className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-5">
          <div className="relative">
            <UserAvatar size={84} src={photo ?? image.data ?? null} />
            <label className="absolute -bottom-1 -right-1 grid size-9 cursor-pointer place-items-center rounded-full border-2 border-surface bg-primary text-primary-fg focus-within:outline focus-within:outline-2 focus-within:outline-focus">
              <Camera className="size-4" aria-hidden />
              <span className="sr-only">Escolher foto</span>
              <input
                type="file"
                className="sr-only"
                accept=".jpg,.jpeg,.jfif,.png,.webp"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  const r = await readAttachment(f, PROFILE_IMAGE_EXTENSIONS);
                  if (r.ok) {
                    setPhoto(r.file.dataUrl);
                    setPhotoError(null);
                  } else setPhotoError(r.error);
                }}
              />
            </label>
          </div>
          <div className="min-w-0">
            <p className="font-display text-3xl leading-tight">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-sm text-ink-3">{user.email}</p>
            {photo && <p className="mt-1 text-xs text-ink-3">Nova foto será enviada ao salvar.</p>}
            {photoError && (
              <p role="alert" className="mt-1 text-xs text-negative">
                {photoError}
              </p>
            )}
          </div>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field label="Nome" htmlFor="pf-first" error={errors.firstName} counter={{ value: firstName.length, max: 30 }}>
            <Input id="pf-first" value={firstName} maxLength={30} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
          </Field>
          <Field label="Sobrenome" htmlFor="pf-last" optional error={errors.lastName}>
            <Input id="pf-last" value={lastName} maxLength={90} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
          </Field>
        </div>
        <div className="mt-5 flex items-center justify-end gap-3">
          {slow && <span className="text-sm text-ink-3">Isso pode levar alguns segundos…</span>}
          <Button variant="primary" onClick={save} loading={saving} disabled={!dirty || !valid}>
            Salvar
          </Button>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Plano" />
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-5">
          <div>
            <p className="font-medium">
              Acesso antecipado <Badge tone="brand">{user.subscriptionPlan === "YEARLY" ? "Anual" : "Mensal"}</Badge>
            </p>
            <p className="text-sm text-ink-3">Todos os recursos liberados durante o acesso antecipado.</p>
          </div>
          <p className="font-display text-3xl">
            <Money value={0} />
          </p>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Segurança" />
        <div className="px-2 pb-2">
          <RowLink icon={<KeyRound />} label="Alterar senha" hint={user.provider === "GOOGLE" ? "Sua conta usa login do Google" : undefined} onClick={user.provider === "GOOGLE" ? undefined : () => openChangePassword()} />
        </div>
      </Panel>

      <Panel className="md:hidden">
        <PanelHeader title="Área da conta" />
        <div className="px-2 pb-2">
          <RowLink icon={<Settings />} label="Configurações" href="/configuracoes" />
          <RowLink icon={<Tags />} label="Categorias" href="/categorias" />
          <RowLink
            icon={<LogOut />}
            label="Sair"
            onClick={async () => {
              await endSession(qc);
              router.replace("/login");
            }}
          />
        </div>
      </Panel>

      <Panel className="border-negative/30">
        <PanelHeader title="Zona de perigo" />
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-5">
          <p className="max-w-md text-sm text-ink-3">Cancelar a conta exclui permanentemente seus dados. Enviaremos um link de confirmação por e-mail.</p>
          <Button variant="danger-ghost" onClick={requestCancel}>
            <ShieldAlert aria-hidden /> Cancelar conta
          </Button>
        </div>
      </Panel>
    </div>
  );
}

function RowLink({ icon, label, hint, href, onClick }: { icon: React.ReactNode; label: string; hint?: string; href?: string; onClick?: () => void }) {
  const cls = "flex w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-3 text-left hover:bg-surface-2 disabled:opacity-60 [&>svg:first-child]:size-[18px] [&>svg:first-child]:text-ink-3";
  const content = (
    <>
      {icon}
      <span className="flex-1">
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="block text-xs text-ink-3">{hint}</span>}
      </span>
      <ChevronRight className="size-4 text-ink-3" aria-hidden />
    </>
  );
  return href ? (
    <Link href={href} className={cls}>
      {content}
    </Link>
  ) : (
    <button type="button" onClick={onClick} disabled={!onClick} className={cls}>
      {content}
    </button>
  );
}

/* ───────── change password (§5.16) ───────── */

function openChangePassword() {
  openOverlay((close) => <ChangePassword onClose={close} />);
}

function ChangePassword({ onClose }: { onClose: () => void }) {
  const setUser = useSession((s) => s.setUser);
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirmPw, setConfirmPw] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const errors = {
    current: !current ? "Informe a senha atual." : undefined,
    next: !isPasswordValid(next) ? "A nova senha não atende aos requisitos." : next === current ? "A nova senha deve ser diferente da atual." : undefined,
    confirm: confirmPw !== next ? "As senhas não conferem." : undefined,
  };
  const save = async () => {
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) return;
    setSaving(true);
    try {
      // Unlike the reference app, passwords travel in the request body, never in the URL.
      setUser(await api.user.changePassword(current, next));
      toast.success("Senha alterada");
      onClose();
    } catch (e) {
      if (isApiError(e) && e.status === 406) toast.error("Senha atual incorreta.");
      else toast.error("Não foi possível alterar a senha.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title="Alterar senha"
      size="sm"
      footer={
        <ModalActions>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={save} loading={saving}>
            Alterar senha
          </Button>
        </ModalActions>
      }
    >
      <div className="grid gap-4">
        <Field label="Senha atual" htmlFor="cp-current" error={submitted ? errors.current : undefined}>
          <PasswordInput id="cp-current" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </Field>
        <Field label="Nova senha" htmlFor="cp-new" error={submitted ? errors.next : undefined}>
          <PasswordInput id="cp-new" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        </Field>
        <PasswordChecklist value={next} />
        <Field label="Confirmar nova senha" htmlFor="cp-confirm" error={submitted ? errors.confirm : undefined}>
          <PasswordInput id="cp-confirm" autoComplete="new-password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
