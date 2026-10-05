import type { Metadata } from "next";
import { StudentProfileView } from "@/components/admin/student-profile-view";

export const metadata: Metadata = { title: "Student profile" };

export default async function StudentProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <StudentProfileView studentId={id} />;
}