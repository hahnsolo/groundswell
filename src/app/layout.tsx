import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { UserNav } from "@/components/user-nav";
import { VerifyBanner } from "@/components/verify-banner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Groundswell — what matters where you live", template: "%s · Groundswell" },
  description:
    "Enter your postal code to see the issues your neighbours care about, meet up with them, and push for change together.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <header className="sticky top-0 z-10 border-b border-border bg-surface/85 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span aria-hidden className="grid h-7 w-7 place-items-center rounded-lg bg-brand text-xs text-white">
                ▲
              </span>
              Groundswell
            </Link>
            <Suspense fallback={<div className="h-8 w-24" />}>
              <UserNav />
            </Suspense>
          </div>
        </header>
        <Suspense>
          <VerifyBanner />
        </Suspense>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-border py-6 text-center text-sm text-muted">
          Built for neighbours. Be kind, be specific, assume good faith.
        </footer>
      </body>
    </html>
  );
}
