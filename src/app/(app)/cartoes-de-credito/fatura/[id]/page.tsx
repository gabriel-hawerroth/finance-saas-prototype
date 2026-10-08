import { Suspense } from "react";
import type { Metadata } from "next";
import { ListSkeleton } from "@/components/shared/content-state";
import { InvoiceView } from "@/features/invoices/invoice-view";

export const metadata: Metadata = { title: "Fatura" };

export default function InvoicePage() {
  return (
    <Suspense fallback={<ListSkeleton rows={6} />}>
      <InvoiceView />
    </Suspense>
  );
}
