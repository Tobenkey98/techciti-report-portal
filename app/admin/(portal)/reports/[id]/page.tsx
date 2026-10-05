import type { Metadata } from "next";
import { ReportDetail } from "@/components/admin/report-detail";

export const metadata: Metadata = { title: "Report" };

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ReportDetail reportId={id} />;
}