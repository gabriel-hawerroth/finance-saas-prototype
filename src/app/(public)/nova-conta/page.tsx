import { Suspense } from "react";
import type { Metadata } from "next";
import { RegisterView } from "@/features/auth/flows";

export const metadata: Metadata = { title: "Criar conta" };

export default function Page() {
  return (
    <Suspense>
      <RegisterView />
    </Suspense>
  );
}
