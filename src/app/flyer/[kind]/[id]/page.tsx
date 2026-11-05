import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { appUrl, ensureShortCode, getFlyer, qrSvg, type SpreadKind } from "@/lib/spread";
import { shortUrl, typedLink } from "@/lib/sources";
import { FlyerSheet } from "@/components/flyer-sheet";

// A one-page flyer to print (#67): the cover, what and when in big plain type,
// and a big QR code to the page. Anyone can print one for a public cause or
// event: spreading the word is the point.

export const metadata: Metadata = { title: "Print a flyer", robots: { index: false } };

export default function FlyerPage({ params }: PageProps<"/flyer/[kind]/[id]">) {
  return (
    <Suspense fallback={<div className="mx-auto my-8 h-[80vh] max-w-2xl animate-pulse rounded-md bg-border/60" />}>
      <Flyer params={params} />
    </Suspense>
  );
}

async function Flyer({ params }: { params: PageProps<"/flyer/[kind]/[id]">["params"] }) {
  const { kind, id } = await params;
  if (kind !== "cause" && kind !== "event") notFound();
  const flyer = await getFlyer(kind as SpreadKind, id);
  if (!flyer) notFound();
  const code = await ensureShortCode(flyer.kind, id);
  const link = code ? shortUrl(appUrl(), code) : `${appUrl()}${flyer.path}?src=flyer`;
  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <Link href={flyer.path} className="text-sm text-muted hover:text-foreground print:hidden">
        ← Back to the {flyer.kind}
      </Link>
      <FlyerSheet flyer={flyer} qr={await qrSvg(link)} link={typedLink(link)} />
    </div>
  );
}
