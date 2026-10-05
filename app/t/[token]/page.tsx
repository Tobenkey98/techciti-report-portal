import type { Metadata } from "next";
import { InstructorPortal } from "@/components/instructor/instructor-portal";

export const metadata: Metadata = {
  title: "Tutor Portal",
  robots: { index: false, follow: false },
};

export default async function TutorPortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <InstructorPortal token={token} />;
}