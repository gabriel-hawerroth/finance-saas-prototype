import type { Metadata } from "next";
import { CategoryReportView } from "@/features/reports/reports-views";

export const metadata: Metadata = { title: "Relatório por categoria" };

export default function Page() {
  return <CategoryReportView />;
}
