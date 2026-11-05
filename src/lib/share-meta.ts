import { STAGE_LABELS, type Stage } from "./stages";
import { placeTime, zoneFor } from "./time-zones";

// What a cause or event says about itself when its link is shared (browser
// tab, WhatsApp/iMessage/Facebook preview cards). Pure, so it's easy to test.
// Hidden and removed content gives nothing away.

export const SITE_NAME = "Groundswell";

/** Trims to a length on a word boundary, with an ellipsis. */
export function clip(text: string, max: number) {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  const atWord = cut.lastIndexOf(" ");
  return `${(atWord > max * 0.6 ? cut.slice(0, atWord) : cut).replace(/[\s.,;:!?-]+$/, "")}…`;
}

type Visibility = { hidden: boolean; removedAt: Date | null };
const visible = (c: Visibility) => !c.hidden && !c.removedAt;

export function joinedLine(members: number) {
  return members === 1 ? "1 neighbour has joined" : `${members} neighbours have joined`;
}

export type CauseShareInput = Visibility & {
  title: string;
  description: string;
  ask?: string | null;
  placeName: string;
  region: string;
  stage: string;
  members: number;
};

export function causeShare(c: CauseShareInput) {
  if (!visible(c)) return null;
  const why = c.ask ? `The ask: ${c.ask}` : c.description;
  return {
    title: clip(c.title, 90),
    description: clip(`${c.placeName}, ${c.region} · ${joinedLine(c.members)}. ${why}`, 200),
    stage: STAGE_LABELS[c.stage as Stage] ?? STAGE_LABELS.raised,
    place: `${c.placeName}, ${c.region}`,
    joined: joinedLine(c.members),
  };
}

export type EventShareInput = {
  title: string;
  startsAt: Date;
  location: string;
  isOnline: boolean;
  going: number;
  cause: Visibility & { title: string; placeName: string; region: string; country: string };
};

export function eventShare(e: EventShareInput) {
  if (!visible(e.cause)) return null;
  // Never the video link: that's only for people going.
  const where = e.isOnline ? "Online" : clip(e.location, 60);
  const when = placeTime(e.startsAt, e.cause.country, e.cause.region);
  return {
    title: clip(e.title, 90),
    description: clip(`${when} · ${where}. Part of “${e.cause.title}” in ${e.cause.placeName}.`, 200),
    when,
    where,
    causeTitle: clip(e.cause.title, 80),
    going: e.going === 1 ? "1 going" : `${e.going} going`,
  };
}

/** On a flyer, big and plain: "Tuesday, November 10" and "6:00 – 8:00 p.m. EST", in the place's time zone (#67). */
export function flyerWhen(start: Date, end: Date, country: string, region: string) {
  const timeZone = zoneFor(country, region);
  const locale = country === "CA" ? "en-CA" : "en-US";
  const day = (d: Date, long = true) =>
    d.toLocaleDateString(locale, { weekday: long ? "long" : "short", month: long ? "long" : "short", day: "numeric", timeZone });
  const time = (d: Date, zone = false) => d.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit", timeZone, ...(zone ? { timeZoneName: "short" } : {}) });
  const sameDay = day(start) === day(end);
  return { day: day(start), time: sameDay ? `${time(start)} – ${time(end, true)}` : `${time(start, true)} until ${day(end, false)}, ${time(end)}` };
}

/** Flyers show the host's first name only: they're posted in public. */
export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}
