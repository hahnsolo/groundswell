import Link from "next/link";
import { Suspense } from "react";
import { currentArea } from "@/lib/current-area";
import { resolvePlace } from "@/lib/places";
import { DEFAULT_RADIUS } from "@/lib/geo";
import { areaHref } from "@/lib/countries";
import { getAreaPulse, getNearbyIssues } from "@/lib/queries";
import { IssueCard } from "@/components/issue-card";
import { PostalSearch } from "@/components/postal-search";
import { WinsStrip } from "@/components/wins-strip";

const STEPS = [
  {
    title: "See what's happening",
    body: "Your postal code shows the causes neighbours are working on nearby, from unsafe crossings to rent hikes.",
  },
  {
    title: "Join in and meet up",
    body: "Add your voice, talk it through with the people who live around you, and meet in person or online.",
  },
  {
    title: "Push for change",
    body: "Turn shared concern into a clear ask: gather signatures and write to the people who can fix it.",
  },
];

// Returning visitors land straight on their neighbourhood's board; first-time
// visitors get a short welcome and a postal code box.
export default function Home() {
  return (
    <Suspense fallback={<div className="mx-auto h-96 max-w-5xl animate-pulse px-4 py-10" />}>
      <HomeContent />
    </Suspense>
  );
}

async function HomeContent() {
  const area = await currentArea();
  const place = area ? await resolvePlace(area.country, area.postal).catch(() => null) : null;
  if (!area || !place) return <Welcome />;

  const issues = await getNearbyIssues({
    country: place.country,
    lat: place.lat,
    lng: place.lng,
    radiusKm: DEFAULT_RADIUS,
    sort: "top",
  });
  const pulse = await getAreaPulse(issues);
  const winIds = new Set(pulse.wins.map((w) => w.id));
  const board = issues.filter((i) => !winIds.has(i.id) && i.status !== "resolved").slice(0, 5);
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const areaLink = areaHref(place.country, place.postalCode);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">Around {place.placeName} right now</h1>
      <p className="mt-2 text-muted">
        {issues.length === 0
          ? "Nobody has raised anything here yet. You could be the first."
          : [
              plural(issues.length, "cause") + " neighbours are working on",
              pulse.eventsThisWeek > 0 && plural(pulse.eventsThisWeek, "event") + " this week",
              pulse.wins.length > 0 && plural(pulse.wins.length, "win") + " this month",
            ]
              .filter(Boolean)
              .join(" · ")}
      </p>

      <WinsStrip wins={pulse.wins} />

      <div className="mt-6 space-y-3">
        {board.map((issue) => (
          <IssueCard key={issue.id} issue={issue} />
        ))}
      </div>

      <Link href={areaLink} className="mt-6 inline-block font-medium text-link underline underline-offset-4">
        See everything around {place.placeName} →
      </Link>

      <section className="mt-12 border-t-[1.5px] border-ink pt-8">
        <h2 className="text-xl font-semibold">Somewhere else?</h2>
        <p className="mb-4 mt-1 text-sm text-muted">Look up any postal code. We only use the first part, never an exact address.</p>
        <div className="max-w-2xl">
          <PostalSearch compact defaultCountry={place.country} />
        </div>
      </section>
    </div>
  );
}

function Welcome() {
  return (
    <div>
      <section className="mx-auto max-w-3xl px-4 pb-16 pt-16 text-center sm:pt-24">
        <h1 className="text-4xl font-semibold leading-tight sm:text-6xl">What&apos;s going on around you?</h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-muted">
          See the causes your neighbours care about, meet the people working on them, and make your street heard.
        </p>
        <div className="mx-auto mt-10 max-w-2xl text-left">
          <PostalSearch />
        </div>
        <p className="mt-3 text-xs text-muted">We only use the first part of your postal code, never your exact address.</p>
      </section>

      <section className="border-t-[1.5px] border-ink">
        <div className="mx-auto grid max-w-5xl gap-8 px-4 py-14 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.title}>
              <div className="mb-3 font-display text-3xl font-semibold text-brand">{i + 1}</div>
              <h2 className="text-lg font-semibold">{s.title}</h2>
              <p className="mt-1 text-sm text-muted">{s.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
