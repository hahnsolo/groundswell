import Link from "next/link";
import { getCategory } from "@/lib/categories";
import { momentum, peopleLine, type Momentum } from "@/lib/momentum";
import type { NearbyCause } from "@/lib/queries";
import { LocalTime } from "./local-time";

// Fixed light fills (not theme colours), so the dark initials stay readable in dark mode too.
const AVATAR_COLOURS = ["bg-[#e9b44c]", "bg-[#a9c4b2]", "bg-[#f0c9b8]"];

/** A cause, pinned to the neighbourhood board: who cares, and what's happening now. */
export function CauseCard({ cause }: { cause: NearbyCause }) {
  const cat = getCategory(cause.category);
  const m = momentum({
    status: cause.status,
    resolvedAt: cause.resolvedAt,
    createdAt: cause.createdAt,
    nextMeetup: cause.nextMeetup,
    campaign: cause.campaign,
    joinedThisWeek: cause.joinedThisWeek,
  });
  const members = cause._count.members;
  return (
    <Link
      href={`/causes/${cause.id}`}
      className="group block rounded-md border-[1.5px] border-ink bg-surface p-4 transition hover:-translate-x-px hover:-translate-y-px hover:shadow-[3px_3px_0_var(--ink)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[11px] uppercase tracking-wide text-muted">
        <span>
          {cat.emoji} {cat.label} · {cause.placeName} · {cause.distanceKm < 1 ? "<1" : Math.round(cause.distanceKm)} km
        </span>
        <MomentumLabel m={m} status={cause.status} />
      </div>
      <h3 className="mt-1.5 text-lg font-semibold leading-snug group-hover:underline">{cause.title}</h3>
      <p className="mt-1 line-clamp-2 text-sm text-muted">{cause.description}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="flex items-center gap-2">
          {cause.memberNames.length > 0 && (
            <span className="flex" aria-hidden="true">
              {cause.memberNames.slice(0, 3).map((name, i) => (
                <span
                  key={i}
                  className={`-mr-1.5 grid h-6 w-6 place-items-center rounded-full border-2 border-surface text-[10px] font-semibold text-[#1f2a44] ${AVATAR_COLOURS[i]}`}
                >
                  {name[0]?.toUpperCase()}
                </span>
              ))}
            </span>
          )}
          <span className={cause.memberNames.length > 0 ? "ml-1.5" : ""}>{peopleLine(cause.memberNames, members)}</span>
        </span>
        {cause._count.comments > 0 && (
          <span className="text-muted">
            {cause._count.comments} {cause._count.comments === 1 ? "message" : "messages"}
          </span>
        )}
      </div>
    </Link>
  );
}

function MomentumLabel({ m, status }: { m: Momentum; status: string }) {
  const strong = "font-semibold normal-case tracking-normal text-foreground text-xs";
  if (!m) return status === "in_progress" ? <span className={strong}>Being worked on</span> : null;
  switch (m.kind) {
    case "won":
      return <span className={`${strong} rounded-full bg-sage/30 px-2 py-0.5`}>✓ Won</span>;
    case "meeting":
      return (
        <span className={strong}>
          Meeting <LocalTime iso={m.startsAt.toISOString()} options={{ weekday: "short", month: "short", day: "numeric" }} />
        </span>
      );
    case "asking":
      return (
        <span className={strong}>
          Asking · {m.signed} of {m.goal} signed
        </span>
      );
    case "growing":
      return <span className={strong}>{m.joinedThisWeek} joined this week</span>;
    case "new":
      return <span className={`${strong} rounded-full bg-mustard/40 px-2 py-0.5`}>New</span>;
  }
}
