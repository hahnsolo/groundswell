import type { Metadata } from "next";

export const metadata: Metadata = { title: "Offline" };

// Precached by the service worker and shown when a page can't load.
export default function OfflinePage() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <div aria-hidden className="mx-auto mb-6 grid h-14 w-14 place-items-center rounded-2xl bg-brand-soft text-2xl">
        📡
      </div>
      <h1 className="text-2xl font-semibold">You&apos;re offline</h1>
      <p className="mt-2 text-muted">
        Groundswell needs a connection to load your community. Check your signal and try again.
      </p>
      {/* A plain link, so it does a full reload rather than a client navigation. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/" className="mt-6 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-strong">
        Try again
      </a>
    </div>
  );
}
