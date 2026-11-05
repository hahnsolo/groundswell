import Link from "next/link";
import type { ReactNode } from "react";

/** Shared look for the privacy policy, terms and code of conduct: one readable column. */
export function LegalPage({ title, updated, intro, children }: { title: string; updated: string; intro: ReactNode; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-2xl px-4 py-10 leading-relaxed">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Last updated {updated}</p>
      <h1 className="mt-2 text-3xl font-semibold leading-tight sm:text-4xl">{title}</h1>
      <div className="mt-4 text-[17px] text-muted">{intro}</div>
      <div className="mt-8 space-y-8 [&_a]:text-link [&_a]:underline [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_li]:mt-1.5 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </div>
      <p className="mt-12 border-t border-border pt-4 text-sm text-muted">
        See also: <Link href="/privacy">Privacy policy</Link> · <Link href="/terms">Terms of use</Link> · <Link href="/conduct">Code of conduct</Link>
      </p>
    </article>
  );
}

/** Until #55 sets up a privacy address. */
export function ContactComingSoon() {
  return (
    <p className="rounded-md bg-mustard/20 p-3 text-sm text-foreground">
      An email address for privacy questions and requests is coming soon. Until then, you can do most things yourself, as described
      on this page.
    </p>
  );
}
