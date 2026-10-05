import type { Metadata } from "next";
import { ReportsView } from "@/components/admin/reports-view";

export const metadata: Metadata = { title: "Reports" };

export default function AdminReportsPage() {
  return <ReportsView />;
}