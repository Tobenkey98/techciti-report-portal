import { AdminShell } from "@/components/admin/admin-shell";

/** Authenticated area: session guard + sidebar chrome live in the shell. */
export default function AdminPortalLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}