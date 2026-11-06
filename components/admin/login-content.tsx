"use client";
// Admin login content component

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoginForm } from "@/components/admin/login-form";
import { auth } from "@/lib/api";

export function AdminLoginContent() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    auth.checkAdminExists().then((exists) => {
      if (!mounted) return;
      if (!exists) {
        router.replace("/admin/signup");
        return;
      }
      setChecking(false);
    });
    return () => {
      mounted = false;
    };
  }, [router]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <p className="text-center text-muted-foreground">Checking admin setup…</p>
      </div>
    );
  }

  return <LoginForm />;
}
