import type { Metadata } from "next";
import { AssignmentsView } from "@/components/admin/assignments-view";

export const metadata: Metadata = { title: "Assignments" };

export default function AdminAssignmentsPage() {
  return <AssignmentsView />;
}