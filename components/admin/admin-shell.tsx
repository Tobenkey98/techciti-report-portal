"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  Link2,
  LogOut,
  Menu,
  Upload,
  Users,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminSession } from "@/hooks/use-admin-session";
import { cn } from "@/lib/utils";

interface AdminNavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Only match the path itself (used by the dashboard link). */
  exact?: boolean;
}

export const ADMIN_NAV: AdminNavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/reports", label: "Reports", icon: ClipboardList },
  { href: "/admin/tutors", label: "Tutors", icon: GraduationCap },
  { href: "/admin/students", label: "Students", icon: Users },
  { href: "/admin/assignments", label: "Assignments", icon: Link2 },
  { href: "/admin/import", label: "Bulk import", icon: Upload },
];

/**
 * Admin chrome: fixed sidebar on desktop, slide-over navigation on mobile,
 * plus the mock-session guard that redirects to /admin/login when needed.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const { session, loading, signOut } = useAdminSession();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  React.useEffect(() => {
    if (!loading && !session) {
      router.replace("/admin/login");
    }
  }, [loading, session, router]);

  if (loading) return <AdminShellSkeleton />;
  if (!session) return <AdminShellSkeleton />;

  const handleSignOut = async () => {
    await signOut();
    router.replace("/admin/login");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3 lg:hidden">
        <Logo showSub />
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Open navigation menu">
              <Menu aria-hidden />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="sm:max-w-[300px]" aria-describedby={undefined}>
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <div className="flex h-full flex-col">
              <div className="border-b border-border px-5 py-4">
                <Logo showSub />
              </div>
              <nav className="flex-1 space-y-1 p-3" aria-label="Admin sections">
                {ADMIN_NAV.map((item) => (
                  <NavLink
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    icon={<item.icon className="size-[18px]" aria-hidden />}
                    active={isActive(pathname, item.href, item.exact)}
                    onNavigate={() => setMobileOpen(false)}
                  />
                ))}
              </nav>
              <div className="border-t border-border p-3">
                <Button variant="ghost" className="w-full justify-start" onClick={handleSignOut}>
                  <LogOut aria-hidden />
                  Sign out
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </header>

      <div className="lg:flex">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen w-[264px] shrink-0 flex-col border-r border-border bg-surface lg:flex">
          <div className="border-b border-border px-5 py-5">
            <Logo showSub />
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Admin sections">
            {ADMIN_NAV.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                icon={<item.icon className="size-[18px]" aria-hidden />}
                active={isActive(pathname, item.href, item.exact)}
              />
            ))}
          </nav>

          <div className="space-y-3 border-t border-border p-3">
            <div className="rounded-xl bg-background p-3">
              <p className="truncate text-sm font-bold text-foreground">{session.name}</p>
              <p className="truncate text-xs text-muted-foreground">{session.email}</p>
            </div>
            <Button variant="ghost" className="w-full justify-start" onClick={handleSignOut}>
              <LogOut aria-hidden />
              Sign out
            </Button>
          </div>
        </aside>

        <main id="main-content" className="min-w-0 flex-1 px-5 py-6 sm:px-8 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

function isActive(pathname: string | null, href: string, exact?: boolean): boolean {
  if (!pathname) return false;
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
  href,
  label,
  icon,
  active,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-button px-3.5 py-2.5 text-[15px] font-semibold transition-colors",
        "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
        active
          ? "bg-primary-soft text-primary"
          : "text-muted-foreground hover:bg-background hover:text-foreground",
      )}
    >
      {icon}
      {label}
    </Link>
  );
}

function AdminShellSkeleton() {
  return (
    <div className="flex min-h-screen">
      <div className="hidden w-[264px] shrink-0 space-y-3 border-r border-border bg-surface p-4 lg:block">
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-11 w-full" />
        ))}
      </div>
      <div className="flex-1 space-y-5 p-8">
        <Skeleton className="h-9 w-64" />
        <div className="grid gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-32 w-full rounded-card" />
          ))}
        </div>
        <Skeleton className="h-72 w-full rounded-card" />
      </div>
    </div>
  );
}