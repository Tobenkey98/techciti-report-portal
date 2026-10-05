import type { Metadata } from "next";
import { ImportView } from "@/components/admin/import-view";

export const metadata: Metadata = { title: "Bulk import" };

export default function AdminImportPage() {
  return <ImportView />;
}