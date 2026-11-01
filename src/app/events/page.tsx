import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { currentArea } from "@/lib/current-area";
import { resolvePlace } from "@/lib/places";
import { DEFAULT_RADIUS, RADIUS_OPTIONS } from "@/lib/geo";
import { getCategory } from "@/lib/categories";
import { getNearbyEvents, type NearbyEvent } from "@/lib/event-queries";
import { LocalTime } from "@/components/local-time";
import { PostalSearch } from "@/components/postal-search";

export const metadata: Metadata = { title: "Events nearby" };

// Every upcoming event for causes around "your neighbourhood".
export default function EventsNearbyPage(props: PageProps<"/events">) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-md bg-border/60" />}>
        <EventsNearby searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function EventsNearby({ searchParams }: Pick<PageProps<"/events">, "searchParams">) {
  const sp = await searchParams;
  const radius = RADIUS_OPTIONS.includes(Number(sp.radius) as (typeof RADIUS_OPTIONS)[number]) ? Number(sp.radius) : DEFAULT_RADIUS;
  const area = await currentArea();
  const place = area ? await resolvePlace(area.country, area.postal).catch(() => null) : null;

  if (!area || !place) {
    return (
      <div className="mx-auto max-w-xl text-center">
        <h1 className="text-3xl font-semibold">Events nearby</h1>
        <p className="mt-2 text-muted">Tell us roughly where you are and we&apos;ll show what&apos;s coming up around you.</p>
        <div className="mt-6 text-left">
          <PostalSearch compact />
        </div>
      </div>
    );
  }

  const user = await getCurrentUser();
  const events = await getNearbyEvents({ country: place.country, lat: place.lat, lng: place.lng, radiusKm: radius }, user?.id ?? null);
  const thisWeek = events.filter((e) => e.thisWeek);
  const later = events.filter((e) => !e.thisWeek);

  return (
    <>
      <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">Events around {place.placeName}</h1>
      <p className="mt-2 text-muted">
        Meetups for causes within {radius} km.{" "}
        <span className="inline-flex flex-wrap items-baseline">
          Look further:{" "}
          {RADIUS_OPTIONS.map((r) => (
            <Link
              key={r}
              href={r === DEFAULT_RADIUS ? "/events" : `/events?radius=${r}`}
              className={`ml-2 ${r === radius ? "font-medium text-foreground underline underline-offset-4" : "hover:text-foreground"}`}
            >
              {r} km
            </Link>
          ))}
        </span>
      </p>

      {events.length === 0 ? (
        <div className="mt-8 rounded-md border-[1.5px] border-dashed border-ink bg-surface p-10 text-center">
          <p className="font-display text-xl font-semibold">Nothing on the calendar yet.</p>
          <p className="mt-2 text-sm text-muted">
            Events are organised from a cause&apos;s Events tab.{" "}
            <Link href={`/area/${place.country.toLowerCase()}/${encodeURIComponent(place.postalCode)}`} className="underline">
              Find a cause around {place.placeName}
            </Link>{" "}
            and get people together.
          </p>
        </div>
      ) : (
        <>
          <EventGroup title="This week" events={thisWeek} />
          <EventGroup title="Later" events={later} />
        </>
      )}
    </>
  );
}

function EventGroup({ title, events }: { title: string; events: NearbyEvent[] }) {
  if (events.length === 0) return null;
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      <ul className="space-y-3">
        {events.map((e) => {
          const cat = getCategory(e.cause.category);
          return (
            <li key={e.id}>
              <Link
                href={`/events/${e.id}`}
                className="group flex gap-4 rounded-md border-[1.5px] border-ink bg-surface p-4 transition hover:-translate-x-px hover:-translate-y-px hover:shadow-[3px_3px_0_var(--ink)]"
              >
                <span className="grid w-14 shrink-0 place-items-center rounded-md bg-ink py-2 text-center text-background">
                  <span className="text-[11px] uppercase tracking-wide opacity-80">
                    <LocalTime iso={e.startsAt.toISOString()} options={{ month: "short" }} />
                  </span>
                  <span className="font-display text-2xl font-semibold leading-none">
                    <LocalTime iso={e.startsAt.toISOString()} options={{ day: "numeric" }} />
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center justify-between gap-x-3 text-[11px] uppercase tracking-wide text-muted">
                    <span>
                      <LocalTime iso={e.startsAt.toISOString()} options={{ weekday: "short", hour: "numeric", minute: "2-digit" }} /> ·{" "}
                      {e.isOnline ? "Online" : e.cause.placeName} · {e.distanceKm < 1 ? "<1" : Math.round(e.distanceKm)} km
                    </span>
                    {e.viewerGoing && <span className="rounded-full bg-sage/30 px-2 py-0.5 font-semibold normal-case tracking-normal text-foreground">✓ Going</span>}
                  </span>
                  <span className="mt-1 block font-display text-lg font-semibold leading-snug group-hover:underline">{e.title}</span>
                  <span className="mt-0.5 block text-sm text-muted">
                    {cat.emoji} For: {e.cause.title} · {e._count.rsvps} going{e.capacity ? ` of ${e.capacity}` : ""}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
