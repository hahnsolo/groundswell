import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { getActiveLedCauses } from "@/lib/queries";
import { canLeadAnother, MAX_LEADING_CAUSES } from "@/lib/leading-limit";
import { STAGE_LABELS, type Stage } from "@/lib/stages";
import { CauseForm } from "@/components/cause-form";

export const metadata: Metadata = { title: "Start a cause" };

export default function NewCausePage(props: PageProps<"/causes/new">) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Start a cause</h1>
      <p className="mb-8 mt-1 text-muted">
        Neighbours nearby will see it, can join, and organize around it.
      </p>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-border/60" />}>
        <NewCause searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function NewCause({ searchParams }: Pick<PageProps<"/causes/new">, "searchParams">) {
  const sp = await searchParams;
  const country = typeof sp.country === "string" ? sp.country : undefined;
  const postal = typeof sp.postal === "string" ? sp.postal : undefined;
  const qs = new URLSearchParams({ ...(country && { country }), ...(postal && { postal }) }).toString();
  const user = await requireUser(`/causes/new${qs ? `?${qs}` : ""}`);
  const leading = await getActiveLedCauses(user.id);
  if (!canLeadAnother(leading.length, user.isAdmin)) return <AtTheLimit causes={leading} />;
  return <CauseForm country={country ?? user.homeCountry ?? "US"} postal={postal ?? user.homePostal ?? ""} />;
}

/** Someone leading the most causes at once: why they can't start another, and the ways out. */
function AtTheLimit({ causes }: { causes: { id: string; title: string; stage: string }[] }) {
  return (
    <section className="rounded-md border-[1.5px] border-ink bg-surface p-5" aria-labelledby="limit">
      <h2 id="limit" className="font-display text-xl font-semibold">
        You&apos;re leading {causes.length} active causes
      </h2>
      <p className="mt-2 text-sm leading-relaxed">
        Each person can lead up to {MAX_LEADING_CAUSES} at a time, so every cause has someone pushing it. To start a new one, finish one of
        these first:
      </p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
        <li>
          <strong>Mark it won</strong> if it&apos;s fixed. Members confirm, and it stops counting.
        </li>
        <li>
          <strong>Close it</strong> if it&apos;s stopped without a win.
        </li>
        <li>
          <strong>Hand it over</strong> to a member who&apos;d like to lead it.
        </li>
      </ul>
      <p className="mt-3 text-sm text-muted">You&apos;ll find all three at the bottom of a cause&apos;s About tab.</p>
      <ul className="mt-4 divide-y divide-border border-y border-border">
        {causes.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
            <Link href={`/causes/${c.id}`} className="min-w-0 font-medium text-link hover:underline">
              {c.title}
            </Link>
            <span className="text-xs text-muted">{STAGE_LABELS[c.stage as Stage]}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
