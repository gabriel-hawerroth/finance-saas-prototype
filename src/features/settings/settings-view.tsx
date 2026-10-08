"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, FlaskConical, Laptop, Loader2, Moon, RotateCcw, Sun, TimerReset, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Segmented } from "@/components/ui/segmented";
import { SwitchRow } from "@/components/ui/switch";
import { PageHeader, Panel, PanelHeader } from "@/components/shared/page-header";
import { api } from "@/data/api";
import { emitApiEvent } from "@/data/api-events";
import { useNetworkLab, type Latency } from "@/data/network-lab";
import { CURRENCIES, LANGUAGES } from "@/domain/constants";
import { ApiError } from "@/domain/errors";
import type { CurrencySymbol, Language, Theme, UserConfigs } from "@/domain/types";
import { confirm } from "@/features/overlays/dialogs";
import { pickConfigs, usePrefs } from "@/features/prefs/store";
import { endSession } from "@/features/session/actions";

type SaveState = "idle" | "saving" | "saved" | "error";

/** Preferences with autosave (§4.20): applied locally at once, sent to the API debounced by 200 ms. */
export function SettingsView() {
  const prefs = usePrefs();
  const [state, setState] = React.useState<SaveState>("idle");
  const touched = React.useRef(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Confirm with the server; ignored if the user already changed something.
  React.useEffect(() => {
    let alive = true;
    api.user
      .configs()
      .then((c) => {
        if (alive && !touched.current) usePrefs.getState().setConfigs(pickConfigs(c));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const change = (patch: Partial<UserConfigs>) => {
    touched.current = true;
    usePrefs.getState().setConfigs(patch);
    if (timer.current) clearTimeout(timer.current);
    setState("saving");
    timer.current = setTimeout(async () => {
      try {
        await api.user.saveConfigs(pickConfigs(usePrefs.getState()));
        setState("saved");
        if (hideTimer.current) clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => setState("idle"), 2000);
      } catch {
        setState("error");
        toast.error("Não foi possível salvar suas preferências. Elas continuam aplicadas neste dispositivo.");
      }
    }, 200);
  };

  return (
    <div className="mx-auto grid max-w-3xl gap-7">
      <PageHeader
        eyebrow="Conta"
        title="Configurações"
        actions={
          <span role="status" aria-live="polite" className="flex h-8 items-center gap-1.5 text-sm text-ink-3">
            {state === "saving" && (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden /> Salvando…
              </>
            )}
            {state === "saved" && (
              <>
                <Check className="size-4 text-positive" aria-hidden /> Salvo
              </>
            )}
          </span>
        }
      />
      <Panel>
        <PanelHeader title="Preferências" description="As mudanças valem na hora e são salvas automaticamente." />
        <div className="grid gap-5 px-5 pb-5">
          <Row label="Tema" id="st-theme">
            <Segmented<Theme>
              label="Tema"
              value={prefs.theme}
              onValueChange={(theme) => change({ theme })}
              options={[
                { value: "light", label: "Claro", icon: <Sun aria-hidden /> },
                { value: "dark", label: "Escuro", icon: <Moon aria-hidden /> },
                { value: "system", label: "Sistema", icon: <Laptop aria-hidden /> },
              ]}
            />
          </Row>
          <Row label="Idioma" id="st-lang" hint="Datas, meses e a navegação seguem o idioma escolhido.">
            <Select id="st-lang" className="w-48" value={prefs.language} onValueChange={(v) => change({ language: v as Language })} options={LANGUAGES} />
          </Row>
          <Row label="Moeda" id="st-cur" hint="Apenas o símbolo exibido; não há conversão de câmbio.">
            <Select id="st-cur" className="w-48" value={prefs.currency} onValueChange={(v) => change({ currency: v as CurrencySymbol })} options={CURRENCIES.map((c) => ({ value: c.value, label: `${c.value} · ${c.label}` }))} />
          </Row>
          <div className="border-t border-line pt-4">
            <SwitchRow id="st-audit" label="Exibir campos de auditoria" hint="Mostra “criado em / alterado em” nos detalhes e formulários." checked={prefs.showAuditFields} onCheckedChange={(v) => change({ showAuditFields: v })} />
          </div>
        </div>
      </Panel>
      <NetworkLab />
    </div>
  );
}

function Row({ label, id, hint, children }: { label: string; id: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <label htmlFor={id} id={`${id}-label`} className="text-sm font-medium">
          {label}
        </label>
        {hint && <p className="text-[13px] text-ink-3">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

/** Prototype-only controls to demonstrate loading, error and session states. */
function NetworkLab() {
  const lab = useNetworkLab();
  const qc = useQueryClient();
  const router = useRouter();
  return (
    <Panel className="border-dashed">
      <PanelHeader
        title={
          <span className="flex items-center gap-2">
            <FlaskConical className="size-4 text-brand-ink" aria-hidden /> Laboratório do protótipo
          </span>
        }
        description="Simule condições de rede para ver estados de carregamento, erro e sessão expirada."
      />
      <div className="grid gap-5 px-5 pb-5">
        <Row label="Latência" id="lab-lat">
          <Segmented<Latency>
            label="Latência"
            value={lab.latency}
            onValueChange={(latency) => lab.set({ latency })}
            options={[
              { value: "instant", label: "Instantânea" },
              { value: "normal", label: "Normal" },
              { value: "slow", label: "Lenta" },
            ]}
          />
        </Row>
        <Row label="Falhas aleatórias" id="lab-fail" hint="Parte das requisições falha, para testar “tentar novamente”.">
          <Segmented
            label="Falhas aleatórias"
            value={String(lab.failureRate)}
            onValueChange={(v) => lab.set({ failureRate: Number(v) })}
            options={[
              { value: "0", label: "0%" },
              { value: "0.2", label: "20%" },
              { value: "0.6", label: "60%" },
            ]}
          />
        </Row>
        <SwitchRow id="lab-off" label="Simular servidor fora do ar" hint="Todas as requisições falham sem conexão." checked={lab.offline} onCheckedChange={(offline) => lab.set({ offline })} />
        <div className="flex flex-wrap gap-2 border-t border-line pt-4">
          <Button size="sm" onClick={() => emitApiEvent(new ApiError(401, { errorDescription: "simulated" }))}>
            <TimerReset aria-hidden /> Simular sessão expirada
          </Button>
          <Button size="sm" onClick={() => router.push("/fora-do-ar")}>
            <Unplug aria-hidden /> Ver página “fora do ar”
          </Button>
          <Button
            size="sm"
            variant="danger-ghost"
            onClick={async () => {
              if (!(await confirm({ title: "Restaurar dados de demonstração", message: "Todos os dados locais do protótipo serão apagados e recriados. Você sairá da conta.", confirmLabel: "Restaurar", tone: "danger" }))) return;
              await api.demo.reset();
              lab.set({ failureRate: 0, offline: false, latency: "normal" });
              await endSession(qc, { callApi: false });
              router.replace("/login");
              toast.success("Dados de demonstração restaurados");
            }}
          >
            <RotateCcw aria-hidden /> Restaurar dados de demonstração
          </Button>
        </div>
      </div>
    </Panel>
  );
}
