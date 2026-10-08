import type { Metadata } from "next";
import { BalanceEvolutionView } from "@/features/reports/reports-views";

export const metadata: Metadata = { title: "Evolução do saldo" };

export default function Page() {
  return <BalanceEvolutionView />;
}
