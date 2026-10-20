import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Fraunces, Inter } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { VerifyBanner } from "@/components/verify-banner";
import { InstallPrompt, ServiceWorkerRegister } from "@/components/pwa";
import "./globals.css";

// Inter for reading, Fraunces (a warm, slightly old-style serif) for headings.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz"],
});

export const metadata: Metadata = {
  title: { default: "Groundswell — what matters where you live", template: "%s · Groundswell" },
  description:
    "Enter your postal code to see the issues your neighbours care about, meet up with them, and push for change together.",
  applicationName: "Groundswell",
  appleWebApp: { capable: true, title: "Groundswell", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4efe6" },
    { media: "(prefers-color-scheme: dark)", color: "#151a24" },
  ],
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <SiteHeader />
        <Suspense>
          <VerifyBanner />
        </Suspense>
        <main className="flex-1">{children}</main>
        <footer className="border-t-[1.5px] border-ink py-8 text-center text-sm text-muted">
          <p className="font-display text-base italic text-foreground">Built for neighbours.</p>
          <p className="mt-1">Be kind, be specific, assume good faith.</p>
        </footer>
        <InstallPrompt />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
