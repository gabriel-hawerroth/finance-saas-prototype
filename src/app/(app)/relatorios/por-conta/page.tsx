import type { Metadata } from "next";
import { AccountReportView } from "@/features/reports/reports-views";

export const metadata: Metadata = { title: "Relatório por conta" };

export default function Page() {
  return <AccountReportView />;
}
