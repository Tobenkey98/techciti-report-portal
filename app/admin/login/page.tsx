import type { Metadata } from "next";
import { AdminLoginContent } from "@/components/admin/login-content";

export const metadata: Metadata = {
  title: "Admin login",
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  return <AdminLoginContent />;
}