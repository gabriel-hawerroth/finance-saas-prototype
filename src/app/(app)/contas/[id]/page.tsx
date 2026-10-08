import type { Metadata } from "next";
import { AccountEditView } from "@/features/accounts/account-edit-view";

export const metadata: Metadata = { title: "Editar conta" };

export default function AccountEditPage() {
  return <AccountEditView />;
}
