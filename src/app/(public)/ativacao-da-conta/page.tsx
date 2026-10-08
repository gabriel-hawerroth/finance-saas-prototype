import { Suspense } from "react";
import type { Metadata } from "next";
import { ActivationView } from "@/features/auth/flows";

export const metadata: Metadata = { title: "Conta ativada" };

export default function Page() {
  return (
    <Suspense>
      <ActivationView />
    </Suspense>
  );
}
