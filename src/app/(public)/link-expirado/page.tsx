import type { Metadata } from "next";
import { Link2Off } from "lucide-react";
import { Notice } from "@/features/public/static-page";

export const metadata: Metadata = { title: "Link expirado" };

export default function Page() {
  return (
    <Notice icon={<Link2Off />} title="Link expirado">
      Este link não é mais válido. Peça um novo e-mail e use o link mais recente.
    </Notice>
  );
}
