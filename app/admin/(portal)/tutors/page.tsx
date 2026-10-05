import type { Metadata } from "next";
import { TutorsView } from "@/components/admin/tutors-view";

export const metadata: Metadata = { title: "Tutors" };

export default function AdminTutorsPage() {
  return <TutorsView />;
}