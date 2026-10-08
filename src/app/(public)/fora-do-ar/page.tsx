import type { Metadata } from "next";
import { OutageNotice } from "@/features/public/notices";

export const metadata: Metadata = { title: "Sistema fora do ar" };

export default function Page() {
  return <OutageNotice />;
}
