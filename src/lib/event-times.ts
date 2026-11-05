// When an event starts and ends, and what that means right now. Pure, so the
// event form, the pages and the calendar file all agree and it's easy to test.

const HOUR = 60 * 60 * 1000;

/** The end time the form suggests, and what events from before end times existed got. */
export const DEFAULT_EVENT_HOURS = 2;
/** Long enough for a weekend clean-up; longer is almost certainly a typo. */
export const MAX_EVENT_DAYS = 3;

export function defaultEnd(start: Date) {
  return new Date(start.getTime() + DEFAULT_EVENT_HOURS * HOUR);
}

/** What's wrong with an end time, in plain words, or null if it's fine. */
export function endProblem(start: Date, end: Date) {
  if (end.getTime() <= start.getTime()) return "The end has to be after the start.";
  if (end.getTime() - start.getTime() > MAX_EVENT_DAYS * 24 * HOUR) return `Events can last up to ${MAX_EVENT_DAYS} days.`;
  return null;
}

export type EventState = "upcoming" | "on" | "over";

/** Upcoming until it starts, on until it ends, then over. */
export function eventState(start: Date, end: Date, now = Date.now()): EventState {
  if (now < start.getTime()) return "upcoming";
  if (now < end.getTime()) return "on";
  return "over";
}
