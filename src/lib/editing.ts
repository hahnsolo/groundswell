// Who can change what after posting. Pure, so the pages (which show the Edit
// buttons) and the actions (which do the saving) agree, and it's easy to test.

import { leadsCause } from "./leadership";

const MINUTE = 60 * 1000;

/** A chat message can be fixed for a short while; after that the conversation has moved on. */
export const MESSAGE_EDIT_MINUTES = 15;

type Removable = { removedAt: Date | null };

/** The people leading a cause (leader and co-leaders) can edit it, unless a moderator removed it. */
export function canEditCause(cause: Removable & Parameters<typeof leadsCause>[0], viewerId: string | null | undefined) {
  return leadsCause(cause, viewerId) && !cause.removedAt;
}

/** The host can edit an event until it's over, unless its cause was removed. */
export function canEditEvent(
  event: { organizerId: string; endsAt: Date; cause: Removable },
  viewerId: string | null | undefined,
  now = Date.now(),
) {
  return !!viewerId && event.organizerId === viewerId && !event.cause.removedAt && event.endsAt.getTime() > now;
}

/** You can edit your own message for 15 minutes, unless a moderator removed it or it was hidden after reports. */
export function canEditMessage(
  message: Removable & { authorId: string; createdAt: Date; hidden: boolean },
  viewerId: string | null | undefined,
  now = Date.now(),
) {
  return (
    !!viewerId &&
    message.authorId === viewerId &&
    !message.removedAt &&
    !message.hidden &&
    now - message.createdAt.getTime() < MESSAGE_EDIT_MINUTES * MINUTE
  );
}
