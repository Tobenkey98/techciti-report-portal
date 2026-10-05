import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Toaster } from "@/components/ui/toaster";
import { APP_FULL_NAME, SITE_URL } from "@/lib/constants";
import "./globals.css";

/**
 * Fonts are self-hosted (see `app/fonts/`) so builds never depend on Google
 * Fonts being reachable. Both files are the latin variable fonts:
 * Manrope 400–800 (primary) and Plus Jakarta Sans 400–700 (fallback).
 */
const manrope = localFont({
  src: "./fonts/manrope-latin-variable.woff2",
  weight: "400 800",
  style: "normal",
  variable: "--font-manrope",
  display: "swap",
  fallback: ["Plus Jakarta Sans", "ui-sans-serif", "system-ui", "sans-serif"],
});

const jakarta = localFont({
  src: "./fonts/plus-jakarta-sans-latin-variable.woff2",
  weight: "400 700",
  style: "normal",
  variable: "--font-jakarta",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

export const metadata: Metadata = {
  title: {
    default: APP_FULL_NAME,
    template: `%s · TechCiti Tutor Portal`,
  },
  description:
    "Submit and manage monthly student learning reports. TechCiti Tutor Report Portal makes tutor reporting fast, clear and paperless.",
  applicationName: APP_FULL_NAME,
  keywords: ["TechCiti", "tutor reports", "education", "student progress", "Nigeria"],
  openGraph: {
    title: APP_FULL_NAME,
    description:
      "Monthly student reports for TechCiti tutors — fast, clear and paperless.",
    url: SITE_URL,
    siteName: APP_FULL_NAME,
    type: "website",
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#FF5733",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${manrope.variable} ${jakarta.variable}`}>
      <body className="min-h-screen bg-background font-sans text-foreground">
        {/* Keyboard users land here first — lets them skip straight to content. */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-button focus:bg-primary focus:px-4 focus:py-2.5 focus:text-[15px] focus:font-bold focus:text-primary-foreground"
        >
          Skip to main content
        </a>
        {children}
        <Toaster />
      </body>
    </html>
  );
}