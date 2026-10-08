import type { Metadata } from "next";
import { CardEditView } from "@/features/cards/card-edit-view";

export const metadata: Metadata = { title: "Editar cartão" };

export default function CardEditPage() {
  return <CardEditView />;
}
