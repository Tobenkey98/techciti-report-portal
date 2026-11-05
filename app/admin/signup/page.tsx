import type { Metadata } from "next";
import { AdminSignupContent } from "@/components/admin/signup-content";

export const metadata: Metadata = {
  title: "Admin set up account",
  robots: { index: false, follow: false },
};

export default function AdminSignupPage() {
  return <AdminSignupContent />;
}
