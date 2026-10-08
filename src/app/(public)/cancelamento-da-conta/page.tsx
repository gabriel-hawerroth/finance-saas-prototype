import { Suspense } from "react";
import type { Metadata } from "next";
import { CancelAccountView } from "@/features/auth/flows";

export const metadata: Metadata = { title: "Cancelar conta" };

export default function Page() {
  return (
    <Suspense>
      <CancelAccountView />
    </Suspense>
  );
}
