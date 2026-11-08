import { getCurrentUser } from "@/lib/auth";
import { canReadChat, chatAccess } from "@/lib/chat-rules";
import { chatMessageView, NEW_MESSAGES_MAX, readAfter } from "@/lib/chat-view";
import { db } from "@/lib/db";
import { leadsCause } from "@/lib/leadership";
import { getCauseMessagesAfter } from "@/lib/queries";

// The messages an open chat doesn't have yet (#101), as a small list. Open chats
// call this when the live connection says something changed, instead of
// reloading the whole page. Same rules as the chat page: only people who can
// read the chat get anything.
export async function GET(request: Request, { params }: RouteContext<"/causes/[id]/chat/messages">) {
  const { id } = await params;
  const after = readAfter(new URL(request.url).searchParams);
  if (!after) return Response.json({ error: "Bad request" }, { status: 400 });

  const user = await getCurrentUser();
  const [cause, membership] = await Promise.all([
    db.cause.findUnique({
      where: { id },
      select: { id: true, authorId: true, leaderId: true, hidden: true, removedAt: true, coLeaders: { select: { userId: true, acceptedAt: true, createdAt: true } } },
    }),
    user ? db.causeMember.findUnique({ where: { causeId_userId: { causeId: id, userId: user.id } }, select: { createdAt: true } }) : null,
  ]);
  if (!cause || cause.removedAt || (cause.hidden && cause.authorId !== user?.id)) return Response.json({ error: "Not found" }, { status: 404 });

  const access = chatAccess({
    signedIn: !!user,
    isAdmin: user?.isAdmin,
    isLeader: leadsCause(cause, user?.id),
    joinedAt: membership?.createdAt ?? null,
    emailVerified: user?.emailVerified,
  });
  if (!canReadChat(access)) return Response.json({ error: "Not found" }, { status: 404 });

  const rows = await getCauseMessagesAfter(id, user?.id ?? null, after, NEW_MESSAGES_MAX + 1);
  const headers = { "Cache-Control": "private, no-store" };
  // Too many to add in place: the chat reloads instead.
  if (rows.length > NEW_MESSAGES_MAX) return Response.json({ reload: true }, { headers });
  const now = Date.now();
  return Response.json({ messages: rows.map((c) => chatMessageView(c, cause, user, now)) }, { headers });
}
