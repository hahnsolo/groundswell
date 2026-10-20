import Link from "next/link";
import { permanentDeletionDate } from "@/lib/moderation";
import { LocalTime, RelativeTime } from "./local-time";

/** A section of a cause page: a note pinned to the board. */
export function Panel({ title, id, children, action }: { title?: string; id?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section id={id} className="rounded-md border-[1.5px] border-ink bg-surface p-5">
      {title && (
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function SignInPrompt({ next, text }: { next: string; text: string }) {
  return (
    <Link href={`/signin?next=${encodeURIComponent(next)}`} className="text-sm font-medium text-link underline">
      Sign in to {text}
    </Link>
  );
}

export function RemovedNotice({ what, removedAt, reason }: { what: "issue" | "comment" | "message"; removedAt: Date; reason: string | null }) {
  return (
    <div role="status" className="rounded-md bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950/40 dark:text-red-200">
      <p>
        <strong>A moderator removed this {what}</strong> <RelativeTime iso={removedAt.toISOString()} />.
        {reason && <> Reason: “{reason}”.</>}
      </p>
      <p className="mt-1">
        Only you can see it, and it will be deleted for good on{" "}
        <LocalTime iso={permanentDeletionDate(removedAt).toISOString()} options={{ month: "long", day: "numeric" }} />.
      </p>
    </div>
  );
}
