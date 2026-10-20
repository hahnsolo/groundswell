import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CATEGORIES } from "@/lib/categories";
import { getCountry, parsePostal } from "@/lib/countries";
import { DEFAULT_RADIUS, RADIUS_OPTIONS } from "@/lib/geo";
import { resolvePlace } from "@/lib/places";
import { getAreaPulse, getNearbyIssues, type IssueSort } from "@/lib/queries";
import { WinsStrip } from "@/components/wins-strip";
import { IssueCard } from "@/components/issue-card";
import { PostalSearch } from "@/components/postal-search";
import { buttonStyles } from "@/components/styles";
import { RememberArea } from "@/components/neighbourhood";

export default function AreaPage(props: PageProps<"/area/[country]/[postal]">) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Suspense fallback={<AreaSkeleton />}>
        <AreaContent params={props.params} searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

function AreaSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 w-64 rounded bg-border" />
      <div className="h-4 w-40 rounded bg-border" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-28 rounded-xl bg-border/60" />
      ))}
    </div>
  );
}

async function AreaContent({
  params,
  searchParams,
}: Pick<PageProps<"/area/[country]/[postal]">, "params" | "searchParams">) {
  const { country: rawCountry, postal: rawPostal } = await params;
  const sp = await searchParams;

  const parsed = parsePostal(rawCountry, decodeURIComponent(rawPostal));
  if (!parsed.ok) notFound();
  const country = parsed.country;

  let place;
  try {
    place = await resolvePlace(country.code, parsed.postal);
  } catch (e) {
    return <p className="rounded-xl bg-red-50 p-4 text-red-700 dark:bg-red-950/40 dark:text-red-300">{(e as Error).message}</p>;
  }
  if (!place) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <h1 className="text-2xl font-semibold">We couldn&apos;t find {country.format(parsed.postal)}</h1>
        <p className="mt-2 text-muted">Double-check the {country.postalLabel.toLowerCase()} and try again.</p>
        <div className="mt-6">
          <PostalSearch defaultCountry={country.code} compact />
        </div>
      </div>
    );
  }

  const radius = RADIUS_OPTIONS.includes(Number(sp.radius) as (typeof RADIUS_OPTIONS)[number])
    ? Number(sp.radius)
    : DEFAULT_RADIUS;
  const category = typeof sp.category === "string" && CATEGORIES.some((c) => c.id === sp.category) ? sp.category : undefined;
  const sort: IssueSort = sp.sort === "new" ? "new" : "top";

  const issues = await getNearbyIssues({ country: place.country, lat: place.lat, lng: place.lng, radiusKm: radius, category, sort });

  const base = `/area/${country.code.toLowerCase()}/${parsed.postal}`;
  const href = (patch: Record<string, string | number | undefined>) => {
    const q = new URLSearchParams();
    const merged = { radius, category, sort, ...patch };
    if (merged.radius !== DEFAULT_RADIUS) q.set("radius", String(merged.radius));
    if (merged.category) q.set("category", String(merged.category));
    if (merged.sort !== "top") q.set("sort", String(merged.sort));
    const s = q.toString();
    return s ? `${base}?${s}` : base;
  };

  const pulse = await getAreaPulse(issues);
  const winIds = new Set(pulse.wins.map((w) => w.id));
  const board = issues.filter((i) => !winIds.has(i.id));
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const pulseLine = [
    plural(pulse.people, "neighbour") + " involved",
    pulse.eventsThisWeek > 0 && plural(pulse.eventsThisWeek, "event") + " this week",
    pulse.wins.length > 0 && plural(pulse.wins.length, "win") + " this month",
  ]
    .filter(Boolean)
    .join(" · ");

  const tab = (active: boolean) =>
    `whitespace-nowrap border-b-2 pb-1 text-sm ${active ? "border-brand font-medium text-foreground" : "border-transparent text-muted hover:text-foreground"}`;
  const option = (active: boolean) => (active ? "font-medium text-foreground underline underline-offset-4" : "text-muted hover:text-foreground");

  return (
    <>
      <RememberArea country={place.country} postal={place.postalCode} name={place.placeName} />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted">
            {getCountry(place.country)?.name} · {country.format(place.postalCode)} · {place.regionCode}
          </p>
          <h1 className="mt-1 text-3xl font-semibold leading-tight sm:text-4xl">What&apos;s going on around {place.placeName}</h1>
          <p className="mt-2 text-muted">{issues.length === 0 ? "Nothing raised nearby yet." : pulseLine}</p>
        </div>
        <Link
          href={`/issues/new?country=${place.country}&postal=${encodeURIComponent(place.postalCode)}`}
          className={`${buttonStyles.secondary} shrink-0`}
        >
          + Raise an issue here
        </Link>
      </div>

      <WinsStrip wins={pulse.wins} />

      <div className="mt-8 space-y-3">
        <nav aria-label="Filter by topic" className="flex gap-5 overflow-x-auto border-b border-border">
          <Link href={href({ category: undefined })} className={tab(!category)}>
            Everything
          </Link>
          {CATEGORIES.map((c) => (
            <Link key={c.id} href={href({ category: c.id })} className={tab(category === c.id)}>
              {c.label}
            </Link>
          ))}
        </nav>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <div className="flex items-center gap-2.5">
            <span className="text-muted">Within</span>
            {RADIUS_OPTIONS.map((r) => (
              <Link key={r} href={href({ radius: r })} className={option(r === radius)}>
                {r} km
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-muted">Show</span>
            <Link href={href({ sort: "top" })} className={option(sort === "top")}>
              Most support
            </Link>
            <Link href={href({ sort: "new" })} className={option(sort === "new")}>
              Newest
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {board.map((issue) => (
          <IssueCard key={issue.id} issue={issue} />
        ))}
        {issues.length === 0 && (
          <div className="rounded-md border-[1.5px] border-dashed border-ink bg-surface p-10 text-center">
            <p className="font-display text-xl font-semibold">Be the first to put something on the board here.</p>
            <p className="mt-2 text-sm text-muted">
              {radius < 50 ? (
                <>
                  Or try <Link href={href({ radius: 50 })} className="underline">looking further out, up to 50 km</Link>.
                </>
              ) : (
                "Raising an issue is how a community starts."
              )}
            </p>
          </div>
        )}
      </div>
    </>
  );
}