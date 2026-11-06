import { FORMER_MEMBER } from "./accounts";
import { readSource, SOURCES } from "./sources";

// Who sees whose name (#79), and the leaders' Members list. Pure, so it's easy to test.

export const A_NEIGHBOUR = "A neighbour";

type Person = { id?: string; name: string; deactivatedAt?: Date | null; showName?: boolean };

/**
 * The name to show for someone. With "Show my name" off they're "A neighbour",
 * except to themselves and to people who see everyone (the cause's leaders,
 * moderators). Leading, co-leading, starting a cause and hosting are public
 * roles: `publicRole` keeps the name there.
 */
export function shownName(person: Person, viewer: { viewerId?: string | null; seesAll?: boolean; publicRole?: boolean } = {}) {
  if (person.deactivatedAt) return FORMER_MEMBER;
  if (person.showName !== false || viewer.seesAll || viewer.publicRole) return person.name;
  if (person.id && person.id === viewer.viewerId) return person.name;
  return A_NEIGHBOUR;
}

export type MemberRow = {
  id: string;
  name: string;
  joinedAt: string;
  signed: boolean;
  going: boolean;
  /** "from your invite", "from the flyer", or null when unknown. */
  from: string | null;
  role: "leads" | "co-leads" | null;
  /** Their name is hidden from everyone but the people leading the cause. */
  hidden: boolean;
  /** The viewer can remove them from the cause (#71). */
  removable?: boolean;
};

/** Where someone came from, in words for the Members list. */
export function fromLabel(source: string | null, invitedById: string | null, viewerId: string) {
  if (invitedById) return invitedById === viewerId ? "from your invite" : "from a co-leader's invite";
  const s = source && source in SOURCES ? (source as keyof typeof SOURCES) : readSource(source);
  return s ? `from ${SOURCES[s].label}` : null;
}

export type MemberFilter = "all" | "not_signed" | "not_going";
export type MemberSort = "newest" | "oldest";

export function listMembers(rows: MemberRow[], filter: MemberFilter, sort: MemberSort) {
  const kept = rows.filter((r) => (filter === "not_signed" ? !r.signed : filter === "not_going" ? !r.going : true));
  return [...kept].sort((a, b) => (sort === "newest" ? b.joinedAt.localeCompare(a.joinedAt) : a.joinedAt.localeCompare(b.joinedAt)));
}
