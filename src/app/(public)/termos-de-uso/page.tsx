import type { Metadata } from "next";
import { TermsOfUse } from "@/features/public/legal";

export const metadata: Metadata = { title: "Termos de uso" };

export default function Page() {
  return <TermsOfUse />;
}
