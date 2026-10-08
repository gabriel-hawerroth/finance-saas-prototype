import type { Metadata } from "next";
import { CardsView } from "@/features/cards/cards-view";

export const metadata: Metadata = { title: "Cartões de crédito" };

export default function CardsPage() {
  return <CardsView />;
}
