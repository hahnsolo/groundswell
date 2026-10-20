// Who can see and post in a cause's chat. Kept free of database code so it's
// easy to test; the chat page and the posting action both use it.
//
//  - You join a cause to see its chat (admins can always look, to moderate).
//  - For the first 24 hours after joining you can read but not post: time to
//    get a feel for the conversation, and it slows down bots that join and spam.
//  - The person who raised the cause can post straight away.
//  - Posting also needs a confirmed email, like everything else people post.

const HOUR = 60 * 60 * 1000;

export const CHAT_COOLING_OFF_HOURS = 24;

export type ChatAccess =
  | { kind: "sign-in" } // not signed in: can't see it
  | { kind: "join" } // signed in, not a member: can't see it
  | { kind: "read"; canPostAt: Date } // member in the cooling-off period
  | { kind: "verify-email" } // can read; must confirm email to post
  | { kind: "post" };

export function chatAccess(
  v: {
    signedIn: boolean;
    isAdmin?: boolean;
    isAuthor?: boolean;
    joinedAt: Date | null;
    emailVerified?: boolean;
  },
  now = new Date(),
): ChatAccess {
  if (!v.signedIn) return { kind: "sign-in" };
  if (!v.joinedAt && !v.isAuthor) return v.isAdmin ? { kind: "read", canPostAt: new Date(8.64e15) } : { kind: "join" };
  if (!v.isAuthor && v.joinedAt) {
    const canPostAt = new Date(v.joinedAt.getTime() + CHAT_COOLING_OFF_HOURS * HOUR);
    if (canPostAt > now) return { kind: "read", canPostAt };
  }
  if (!v.emailVerified) return { kind: "verify-email" };
  return { kind: "post" };
}

export const canReadChat = (a: ChatAccess) => a.kind !== "sign-in" && a.kind !== "join";
