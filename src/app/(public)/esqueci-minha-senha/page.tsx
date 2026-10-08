import { Suspense } from "react";
import type { Metadata } from "next";
import { ForgotPasswordView } from "@/features/auth/flows";

export const metadata: Metadata = { title: "Esqueci minha senha" };

export default function Page() {
  return (
    <Suspense>
      <ForgotPasswordView />
    </Suspense>
  );
}
