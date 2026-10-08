"use client";
import * as React from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import { Toaster, toast } from "sonner";
import { useRouter } from "next/navigation";
import { TooltipProvider } from "@/components/ui/menu";
import { onApiEvent } from "@/data/api-events";
import { ApiError } from "@/domain/errors";
import { OverlayHost } from "@/features/overlays/store";
import { ThemeSync } from "@/features/prefs/theme-sync";
import { endSession } from "@/features/session/actions";
import { useSession } from "@/features/session/store";

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (count, error) => {
          // One automatic retry, except for auth / throttle / offline / business errors.
          if (error instanceof ApiError && [0, 401, 403, 404, 410, 422, 429].includes(error.status)) return false;
          return count < 1;
        },
      },
      mutations: { retry: false },
    },
  });
}

let browserClient: QueryClient | undefined;
function getClient() {
  if (typeof window === "undefined") return makeClient();
  browserClient ??= makeClient();
  return browserClient;
}

/** Global transport errors (§9.4), throttled so a burst produces one message. */
function ApiEventBridge() {
  const qc = useQueryClient();
  const router = useRouter();
  React.useEffect(() => {
    const last: Record<string, number> = {};
    const once = (key: string, ms: number) => {
      const now = Date.now();
      if (now - (last[key] ?? 0) < ms) return false;
      last[key] = now;
      return true;
    };
    return onApiEvent((error) => {
      if ((error.status === 401 || error.status === 403) && useSession.getState().user) {
        if (!once("auth", 4000)) return;
        void endSession(qc, { callApi: false }).then(() => {
          toast.warning("Seu acesso expirou. Entre novamente.");
          router.replace("/login");
        });
      } else if (error.status === 0 && once("offline", 4000)) {
        toast.error("Sem conexão com o servidor. Tente novamente em instantes.");
      } else if (error.status === 429 && once("429", 4000)) {
        toast.warning("Muitas tentativas. Aguarde um pouco e tente de novo.");
      }
    });
  }, [qc, router]);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={getClient()}>
      <MotionConfig reducedMotion="user">
        <TooltipProvider>
          <ThemeSync />
          <ApiEventBridge />
          {children}
          <OverlayHost />
          <Toaster
            position="bottom-center"
            duration={3500}
            mobileOffset={{ bottom: "calc(88px + env(safe-area-inset-bottom))" }}
            closeButton
            toastOptions={{
              classNames: {
                toast: "!rounded-[var(--radius-lg)] !border-line !bg-surface !text-ink !shadow-[var(--shadow-lift)] !font-sans",
                description: "!text-ink-3",
                actionButton: "!bg-primary !text-primary-fg",
              },
            }}
          />
        </TooltipProvider>
      </MotionConfig>
    </QueryClientProvider>
  );
}
