import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import Link from "next/link";
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
  // Shared links need full URLs for their preview images.
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: { default: "Groundswell — what matters where you live", template: "%s · Groundswell" },
  description:
    "Enter your postal code to see the causes your neighbours care about, meet up with them, and push for change together.",
  openGraph: { siteName: "Groundswell", type: "website", locale: "en_CA" },
  twitter: { card: "summary_large_image" },
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
          <nav aria-label="About Groundswell" className="mt-3 flex justify-center gap-4">
            <Link href="/privacy" className="hover:text-foreground hover:underline">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-foreground hover:underline">
              Terms
            </Link>
            <Link href="/conduct" className="hover:text-foreground hover:underline">
              Code of conduct
            </Link>
          </nav>
        </footer>
        <InstallPrompt />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
