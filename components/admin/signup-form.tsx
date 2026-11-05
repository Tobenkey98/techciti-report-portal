"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, Mail, User, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAdminSession } from "@/hooks/use-admin-session";

export function SignupForm() {
  const router = useRouter();
  const toast = useToast();
  const { signIn, signUp } = useAdminSession();

  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [errors, setErrors] = React.useState<{ name?: string; email?: string; password?: string; confirmPassword?: string; form?: string }>({});
  const [submitting, setSubmitting] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    if (!name.trim()) { setErrors({ name: "Name required" }); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErrors({ email: "Valid email required" }); return; }
    if (password.length < 8) { setErrors({ password: "Password min 8 chars" }); return; }
    if (password !== confirmPassword) { setErrors({ confirmPassword: "Passwords do not match" }); return; }
    setSubmitting(true);
    try {
      await signUp(name, email, password);
      await signIn(email, password);
      toast.success({ title: "Admin account created", description: "Logging in…" });
      router.replace("/admin");
    } catch (err: any) {
      setErrors({ form: err.message ?? "Setup failed" });
      toast.error({ title: "Setup failed", description: err.message ?? "Unknown error" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 lg:p-8">
      <div className="w-full max-w-md space-y-6">
        <h1 className="text-2xl font-bold">Set up admin account</h1>
        <p className="text-sm text-muted-foreground">This is a one-time setup. After creating the first admin, only sign-in will be available.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Full name</Label>
            <Input id="name" type="text" autoComplete="name" placeholder="Jane Doe" value={name} onChange={(e) => { setName(e.target.value); setErrors((c) => ({ ...c, name: undefined })); }} aria-invalid={Boolean(errors.name)} className="pl-10" />
            {errors.name && <p role="alert" className="text-sm font-medium text-destructive">{errors.name}</p>}
          </div>
          <div>
            <Label htmlFor="email">Email address</Label>
            <Input id="email" type="email" autoComplete="email" placeholder="you@techciti.ng" value={email} onChange={(e) => { setEmail(e.target.value); setErrors((c) => ({ ...c, email: undefined })); }} aria-invalid={Boolean(errors.email)} className="pl-10" />
            {errors.email && <p role="alert" className="text-sm font-medium text-destructive">{errors.email}</p>}
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input id="password" type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="••••••••" value={password} onChange={(e) => { setPassword(e.target.value); setErrors((c) => ({ ...c, password: undefined })); }} aria-invalid={Boolean(errors.password)} className="pl-10" />
              <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-primary">
                {showPassword ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
              </button>
            </div>
            {errors.password && <p role="alert" className="text-sm font-medium text-destructive">{errors.password}</p>}
          </div>
          <div>
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input id="confirmPassword" type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="••••••••" value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); setErrors((c) => ({ ...c, confirmPassword: undefined })); }} aria-invalid={Boolean(errors.confirmPassword)} className="pl-10" />
            {errors.confirmPassword && <p role="alert" className="text-sm font-medium text-destructive">{errors.confirmPassword}</p>}
          </div>
          {errors.form && <p role="alert" className="text-sm font-medium text-destructive">{errors.form}</p>}
          <Button type="submit" className="w-full" disabled={submitting} loading={submitting}>
            <ShieldCheck className="mr-2 size-4" aria-hidden />
            Create admin account
          </Button>
        </form>
      </div>
    </div>
  );
}