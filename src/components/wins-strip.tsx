import Link from "next/link";
import { peopleLine } from "@/lib/momentum";
import type { NearbyIssue } from "@/lib/queries";
import { RelativeTime } from "./local-time";

/** Recent wins, up front: proof to neighbours that working together works. */
export function WinsStrip({ wins }: { wins: NearbyIssue[] }) {
  if (wins.length === 0) return null;
  return (
    <section className="mt-6" aria-labelledby="wins">
      <h2 id="wins" className="mb-2 text-sm font-semibold">
        Recent wins
      </h2>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {wins.map((w) => (
          <Link
            key={w.id}
            href={`/issues/${w.id}`}
            className="w-64 shrink-0 rounded-md border-[1.5px] border-ink bg-sage/25 p-3 hover:bg-sage/40 sm:w-72"
          >
            <p className="text-xs font-semibold">
              ✓ Won {w.resolvedAt && <RelativeTime iso={w.resolvedAt.toISOString()} />}
            </p>
            <p className="mt-1 line-clamp-2 font-display font-semibold leading-snug">{w.title}</p>
            <p className="mt-1 text-xs text-muted">{peopleLine(w.supporterNames, w._count.supports)}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
