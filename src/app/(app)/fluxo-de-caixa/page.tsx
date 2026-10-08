import type { Metadata } from "next";
import { CashFlowView } from "@/features/cash-flow/cash-flow-view";

export const metadata: Metadata = { title: "Fluxo de caixa" };

export default function CashFlowPage() {
  return <CashFlowView />;
}
