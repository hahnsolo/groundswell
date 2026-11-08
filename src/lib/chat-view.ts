import { canEditMessage } from "./editing";
import { canHideMessage, removeProblem } from "./leader-moderation";
import { leadsCause } from "./leadership";
import { shownName } from "./member-list";

// What one viewer sees of one chat message (#101): the same for the chat page and
// for the small list of new messages an open chat fetches, so both always agree.
// Plain data, so it can go to the browser. Pure, so it's easy to test.

export type ChatMessageRow = {
  id: string;
  body: string;
  createdAt: Date;
  editedAt: Date | null;
  hidden: boolean;
  removedAt: Date | null;
  removalReason: string | null;
  hiddenByLeaderId: string | null;
  author: { id: string; name: string; deactivatedAt: Date | null; showName: boolean; isAdmin: boolean };
};

export type ChatCause = {
  id: string;
  authorId: string;
  leaderId: string;
  coLeaders: { userId: string; acceptedAt: Date | null; createdAt: Date }[];
};

export type ChatViewer = { id?: string | null; isAdmin?: boolean; emailVerified?: boolean } | null;

export type ChatMessageView = {
  id: string;
  authorId: string;
  createdAt: string;
  edited: boolean;
  /** The author's name as this viewer may see it. */
  name: string;
  deactivated: boolean;
  /** "leads this", "co-leads this", "started this", or null. */
  role: string | null;
  /** Empty when the viewer only gets the "hidden by the people leading" placeholder: the words never leave the server. */
  body: string;
  placeholder: boolean;
  hidden: boolean;
  hiddenByLeader: boolean;
  removedAt: string | null;
  removalReason: string | null;
  mine: boolean;
  canEdit: boolean;
  canReport: boolean;
  canHide: boolean;
  canUnhide: boolean;
  remove: { causeId: string; userId: string; name: string } | null;
};

export function chatMessageView(c: ChatMessageRow, cause: ChatCause, viewer: ChatViewer, now = Date.now()): ChatMessageView {
  const viewerId = viewer?.id ?? null;
  const viewerLeads = leadsCause(cause, viewerId);
  const mine = c.author.id === viewerId;
  const role = c.author.id === cause.leaderId ? "leads this" : leadsCause(cause, c.author.id) ? "co-leads this" : c.author.id === cause.authorId ? "started this" : null;
  // Hidden by a leader (#71): only its author still sees the words.
  const hiddenByLeader = !!c.hiddenByLeaderId;
  const placeholder = hiddenByLeader && !mine;
  const asViewer = { id: viewerId, leads: viewerLeads };
  const canRemove =
    !c.author.deactivatedAt &&
    !removeProblem(asViewer, {
      id: c.author.id,
      isAdmin: c.author.isAdmin,
      isLeader: c.author.id === cause.leaderId,
      isCoLeader: leadsCause(cause, c.author.id) && c.author.id !== cause.leaderId,
    });
  return {
    id: c.id,
    authorId: c.author.id,
    createdAt: c.createdAt.toISOString(),
    edited: !!c.editedAt,
    name: shownName(c.author, { viewerId, seesAll: viewerLeads || !!viewer?.isAdmin, publicRole: !!role }),
    deactivated: !!c.author.deactivatedAt,
    role,
    body: placeholder ? "" : c.body,
    placeholder,
    hidden: c.hidden,
    hiddenByLeader,
    removedAt: c.removedAt?.toISOString() ?? null,
    removalReason: c.removedAt ? c.removalReason : null,
    mine,
    canEdit: !hiddenByLeader && canEditMessage({ ...c, authorId: c.author.id }, viewerId, now),
    // Hiding already files a report, so leaders get Report only on what they can't hide (a moderator's message).
    canReport: !!viewer?.emailVerified && !mine && !hiddenByLeader && !canHideMessage(asViewer, c.author),
    canHide: !c.hidden && !c.removedAt && canHideMessage(asViewer, c.author),
    canUnhide: hiddenByLeader && viewerLeads,
    remove: canRemove ? { causeId: cause.id, userId: c.author.id, name: c.author.name } : null,
  };
}

/** At most this many new messages in one fetch; past that, the chat reloads instead. */
export const NEW_MESSAGES_MAX = 100;

/** Reads "?after=<id>&at=<ISO time>" from an open chat: the newest message it already has. */
export function readAfter(params: URLSearchParams): { id: string; createdAt: Date } | null {
  const id = params.get("after") ?? "";
  const at = new Date(params.get("at") ?? "");
  if (!/^[a-z0-9]{1,40}$/i.test(id) || Number.isNaN(at.getTime())) return null;
  return { id, createdAt: at };
}

/** Joins messages that arrived live onto the ones the page brought, without repeats, oldest first. */
export function withArrivals(page: ChatMessageView[], arrived: ChatMessageView[]) {
  const last = page.at(-1);
  const have = new Set(page.map((m) => m.id));
  const newer = arrived.filter((m) => !have.has(m.id) && (!last || m.createdAt > last.createdAt || (m.createdAt === last.createdAt && m.id > last.id)));
  return newer.length ? [...page, ...newer] : page;
}
