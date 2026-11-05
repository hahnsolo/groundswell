import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { unsubscribeFromLink } from "@/app/actions/notifications";
import { isNotifyKind, NOTIFY_KINDS } from "@/lib/notify-rules";
import { buttonStyles } from "@/components/styles";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false } };

// From the link at the bottom of every notification email. Asks first, so
// link scanners opening the page don't turn anything off.
export default function UnsubscribePage(props: PageProps<"/unsubscribe">) {
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <Suspense fallback={<div className="h-40 animate-pulse rounded-md bg-border/60" />}>
        <Unsubscribe searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function Unsubscribe({ searchParams }: Pick<PageProps<"/unsubscribe">, "searchParams">) {
  const sp = await searchParams;
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const kind = get("k");
  const label = kind === "all" ? "all notification emails" : isNotifyKind(kind) ? `${NOTIFY_KINDS[kind].label} emails` : null;

  if (sp.done) {
    return (
      <section className="rounded-md border-[1.5px] border-ink bg-surface p-6">
        <h1 className="font-display text-2xl font-semibold">You&apos;re unsubscribed</h1>
        <p className="mt-2 text-muted">
          {sp.done === "1" ? `We won't send you ${label ?? "those emails"} any more.` : "That link didn't work. It may have been copied incompletely."} You can
          change any of this on <Link href="/me#email" className="text-link underline">your activity page</Link>.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-md border-[1.5px] border-ink bg-surface p-6">
      <h1 className="font-display text-2xl font-semibold">Unsubscribe</h1>
      {label ? (
        <form action={unsubscribeFromLink} className="mt-3 space-y-4">
          <input type="hidden" name="u" value={get("u")} />
          <input type="hidden" name="k" value={kind} />
          <input type="hidden" name="t" value={get("t")} />
          <p className="text-muted">Stop {label} from Groundswell? Emails about signing in and your account still come.</p>
          <button className={buttonStyles.primary}>Unsubscribe</button>
        </form>
      ) : (
        <p className="mt-2 text-muted">
          That link isn&apos;t complete. You can choose which emails you get on <Link href="/me#email" className="text-link underline">your activity page</Link>.
        </p>
      )}
    </section>
  );
}
