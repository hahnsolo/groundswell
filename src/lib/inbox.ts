import "server-only";
import { cache } from "react";
import { db } from "./db";

/** Your latest notifications and how many are unread (#95). Cached per request. */
export const getInbox = cache(async (userId: string, take: number) => {
  const [unread, rows] = await Promise.all([
    db.notification.count({ where: { userId, readAt: null } }),
    db.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take, select: { id: true, title: true, body: true, url: true, createdAt: true, readAt: true } }),
  ]);
  return {
    unread,
    items: rows.map((n) => ({ id: n.id, title: n.title, body: n.body, url: n.url, createdAt: n.createdAt.toISOString(), unread: !n.readAt })),
  };
});
