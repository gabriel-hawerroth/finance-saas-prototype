import { Suspense } from "react";
import type { Metadata } from "next";
import { RecoveryView } from "@/features/auth/flows";

export const metadata: Metadata = { title: "Nova senha" };

export default function Page() {
  return (
    <Suspense>
      <RecoveryView />
    </Suspense>
  );
}
