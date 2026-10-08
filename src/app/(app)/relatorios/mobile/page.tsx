import { redirect } from "next/navigation";

/** Legacy mobile-only route: the reports are now responsive, so it lands on the category report. */
export default function MobileReportsPage() {
  redirect("/relatorios/por-categoria");
}
