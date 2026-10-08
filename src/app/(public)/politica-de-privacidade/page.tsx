import type { Metadata } from "next";
import { PrivacyPolicy } from "@/features/public/legal";

export const metadata: Metadata = { title: "Política de privacidade" };

export default function Page() {
  return <PrivacyPolicy />;
}
