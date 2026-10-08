import type { Metadata } from "next";
import { ShieldX } from "lucide-react";
import { Notice } from "@/features/public/static-page";

export const metadata: Metadata = { title: "Erro na ativação" };

export default function Page() {
  return (
    <Notice icon={<ShieldX />} title="Não foi possível ativar">
      Algo deu errado ao ativar sua conta. Tente abrir o link novamente ou solicite um novo e-mail de ativação.
    </Notice>
  );
}
