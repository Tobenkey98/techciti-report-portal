import type { Metadata } from "next";
import { StudentsView } from "@/components/admin/students-view";

export const metadata: Metadata = { title: "Students" };

export default function AdminStudentsPage() {
  return <StudentsView />;
}