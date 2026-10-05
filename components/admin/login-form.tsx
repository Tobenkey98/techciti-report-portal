"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, Lock, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAdminSession } from "@/hooks/use-admin-session";
import { DEMO_ADMIN } from "@/lib/constants";
import { DEMO_TUTOR_LINKS as TUTOR_LINKS } from "@/lib/mock-data";
import { firstName } from "@/lib/utils";

export function LoginForm() {
  const router = useRouter();
  const toast = useToast();
  const { session, loading, signIn } = useAdminSession();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [errors, setErrors] = React.useState<{ email?: string; password?: string; form?: string }>({});
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!loading && session) router.replace("/admin");
  }, [loading, session, router]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const nextErrors: typeof errors = {};

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      nextErrors.email = "Enter a valid email address.";
    }
    if (password.length < 6) nextErrors.password = "Enter your password.";

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      await signIn(email, password);
      toast.success({ title: "Welcome back", description: "Taking you to the dashboard…" });
      router.replace("/admin");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sign in failed.";
      setErrors({ form: message });
      toast.error({ title: "Could not sign in", description: message });
    } finally {
      setSubmitting(false);
    }
  }

  function fillDemo() {
    setEmail(DEMO_ADMIN.email);
    setPassword(DEMO_ADMIN.password);
    setErrors({});
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      {/* Slanted orange panel */}
      <aside className="slant-left relative hidden overflow-hidden bg-primary p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <div className="hero-grid pointer-events-none absolute inset-0 opacity-70" aria-hidden />
        <Link href="/" className="relative w-fit">
          <Logo invert markClassName="size-10" />
        </Link>

        <div className="relative max-w-md">
          <h2 className="text-3xl font-extrabold leading-tight tracking-tight xl:text-4xl">
            Every tutor report, in one place.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-primary-foreground/90">
            Track submissions, follow up on WhatsApp and send parents reports they can
            actually read.
          </p>

          <ul className="mt-9 space-y-4">
            {[
              "Live submission tracking for every tutor",
              "Branded PDF and Word reports in one click",
              "Bulk import for tutors and students",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 text-[15px]">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-foreground/20">
                  <Sparkles className="size-3.5" aria-hidden />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-sm text-primary-foreground/80">
          © {new Date().getFullYear()} TechCiti · techciti.ng
        </p>
      </aside>

      {/* Form */}
      <div className="flex flex-col bg-surface">
        <header className="flex items-center justify-between border-b border-border px-5 py-4 lg:hidden">
          <Logo showSub />
          <Button asChild variant="ghost" size="sm">
            <Link href="/">
              <ArrowLeft aria-hidden />
              Home
            </Link>
          </Button>
        </header>

        <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-md">
            <div className="hidden items-center justify-between lg:flex">
              <p className="text-sm font-semibold text-muted-foreground">
                TechCiti staff only
              </p>
              <Button asChild variant="ghost" size="sm">
                <Link href="/">
                  <ArrowLeft aria-hidden />
                  Back to site
                </Link>
              </Button>
            </div>

            <h1 className="mt-6 text-3xl font-extrabold tracking-tight lg:mt-0">Admin sign in</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
              Use your TechCiti admin credentials to manage tutors, students and reports.
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
              {errors.form ? (
                <div
                  role="alert"
                  className="rounded-card border border-danger/30 bg-danger-soft px-4 py-3 text-sm font-medium text-danger"
                >
                  {errors.form}
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <div className="relative">
                  <Mail
                    className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@techciti.ng"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setErrors((current) => ({ ...current, email: undefined, form: undefined }));
                    }}
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? "email-error" : undefined}
                    className="pl-10"
                  />
                </div>
                {errors.email ? (
                  <p id="email-error" role="alert" className="text-sm font-medium text-danger">
                    {errors.email}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <span className="text-xs font-semibold text-muted-foreground">
                    Demo access below
                  </span>
                </div>
                <div className="relative">
                  <Lock
                    className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setErrors((current) => ({ ...current, password: undefined, form: undefined }));
                    }}
                    aria-invalid={Boolean(errors.password)}
                    className="px-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted-foreground transition-colors hover:bg-primary-soft hover:text-primary"
                  >
                    {showPassword ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                  </button>
                </div>
                {errors.password ? (
                  <p role="alert" className="text-sm font-medium text-danger">
                    {errors.password}
                  </p>
                ) : null}
              </div>

              <Button type="submit" size="lg" className="w-full" loading={submitting}>
                <ShieldCheck aria-hidden />
                Sign in to admin
              </Button>
            </form>

            {/* Demo helper */}
            <div className="mt-8 rounded-card border border-border bg-background p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground">Demo credentials</p>
                  <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                    {DEMO_ADMIN.email} · {DEMO_ADMIN.password}
                  </p>
                </div>
                <Button type="button" variant="secondary" size="sm" onClick={fillDemo}>
                  Fill in
                </Button>
              </div>

              <div className="mt-4 border-t border-border pt-4">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Tutor portal links
                </p>
                <ul className="mt-2 space-y-1">
                  {TUTOR_LINKS.slice(0, 3).map((tutor) => (
                    <li key={tutor.id}>
                      <Link
                        href={tutor.path}
                        className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-primary-soft hover:text-primary"
                      >
                        <span className="truncate">
                          {firstName(tutor.fullName)} · {tutor.subjects[0]}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">Open →</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}