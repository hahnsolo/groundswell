import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { moderate, restore } from "@/app/actions/admin";
import { liftCauseBan, undoLeaderHide } from "@/app/actions/leader-moderation";
import { RelativeTime } from "@/components/local-time";
import { buttonStyles, inputStyles } from "@/components/styles";
import { displayName } from "@/lib/accounts";
import { MAX_REMOVAL_REASON, permanentDeletionDate, purgeCutoff, REMOVAL_RETENTION_DAYS } from "@/lib/moderation";
import { storageUsed } from "@/lib/covers";
import { STORAGE_STOP_BYTES, storageState } from "@/lib/media-rules";

// No title: the static shell shouldn't hint at what this page is.
export const metadata: Metadata = { robots: { index: false } };

export default function ReportsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      {/* Everything, including the heading, waits on the admin check so the
          page reveals nothing to non-admins. */}
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-border/60" />}>
        <Queue />
      </Suspense>
    </div>
  );
}

type Target = {
  type: "cause" | "comment";
  id: string;
  reports: { reason: string; createdAt: Date; reporter: string }[];
};

/** What people call these on the site. */
const kindLabel = (type: Target["type"]) => (type === "cause" ? "cause" : "message");

async function Queue() {
  await requireAdmin();
  const reports = await db.report.findMany({
    where: { resolved: false },
    orderBy: { createdAt: "asc" },
    include: { reporter: { select: { name: true } } },
    take: 500,
  });

  // Group reports by the content they point at.
  const targets = new Map<string, Target>();
  for (const r of reports) {
    const key = `${r.targetType}:${r.targetId}`;
    const t = targets.get(key) ?? { type: r.targetType as Target["type"], id: r.targetId, reports: [] };
    t.reports.push({ reason: r.reason, createdAt: r.createdAt, reporter: r.reporter.name });
    targets.set(key, t);
  }
  const list = [...targets.values()].sort((a, b) => b.reports.length - a.reports.length);

  const ids = (type: Target["type"]) => list.filter((t) => t.type === type).map((t) => t.id);
  const [causes, comments] = await Promise.all([loadCauses(ids("cause")), loadComments(ids("comment"))]);
  const causeById = new Map(causes.map((i) => [i.id, i]));
  const commentById = new Map(comments.map((c) => [c.id, c]));
  // Image storage (#66): free up to 1 GB on Vercel Blob; uploads pause at 850 MB.
  const used = await storageUsed();
  const storage = storageState(used);
  const mb = (b: number) => Math.round(b / (1024 * 1024));

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Moderation queue</h1>
      <p className="mb-6 mt-1 text-sm text-muted">
        Content reported by the community. Items with 3+ reports are already hidden until you decide.
      </p>
      {storage !== "ok" && (
        <p role="status" className="mb-6 rounded-md border-[1.5px] border-ink bg-mustard/25 p-3 text-sm">
          <strong>Image storage is {storage === "full" ? "full: new uploads are paused" : "nearly full"}</strong> ({mb(used)} MB of{" "}
          {mb(STORAGE_STOP_BYTES)} MB). Removing unwanted images frees room; moving to Cloudflare R2 (#77) gives 10 GB free.
        </p>
      )}
      <p className="mb-6 text-xs text-muted">Images stored: {mb(used)} MB of {mb(STORAGE_STOP_BYTES)} MB before uploads pause.</p>
      {list.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-surface p-10 text-center text-muted">All clear — nothing to review.</p>
      ) : (
        <QueueList list={list} causeById={causeById} commentById={commentById} />
      )}
      <RecentlyRemoved />
      <LeaderLog />
    </>
  );
}

const ACTION_WORDS: Record<string, string> = {
  hide: "hid a message by",
  unhide: "un-hid a message by",
  remove: "removed",
  undo_hide: "(moderator) undid hiding a message by",
  lift_ban: "(moderator) lifted the removal of",
};

/** What leaders did in their own causes (#71): every hide and removal, with undo while it still stands. */
async function LeaderLog() {
  const actions = await db.leaderAction.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  const unique = (ids: (string | null)[]) => [...new Set(ids.filter((i): i is string => !!i))];
  const [people, causes, comments, bans] = await Promise.all([
    db.user.findMany({ where: { id: { in: unique(actions.flatMap((a) => [a.byUserId, a.targetUserId])) } }, select: { id: true, name: true, deactivatedAt: true } }),
    db.cause.findMany({ where: { id: { in: unique(actions.map((a) => a.causeId)) } }, select: { id: true, title: true } }),
    db.comment.findMany({ where: { id: { in: unique(actions.map((a) => a.commentId)) } }, select: { id: true, body: true, hiddenByLeaderId: true } }),
    db.causeBan.findMany({ where: { causeId: { in: unique(actions.map((a) => a.causeId)) }, liftedAt: null }, select: { causeId: true, userId: true } }),
  ]);
  const person = new Map(people.map((p) => [p.id, displayName(p)]));
  const cause = new Map(causes.map((c) => [c.id, c.title]));
  const comment = new Map(comments.map((c) => [c.id, c]));
  const banned = new Set(bans.map((b) => `${b.causeId}:${b.userId}`));
  const seen = new Set<string>(); // only the latest action on something offers an undo

  return (
    <section className="mt-12" aria-labelledby="leader-log">
      <h2 id="leader-log" className="text-lg font-semibold tracking-tight">
        What leaders did
      </h2>
      <p className="mb-4 mt-1 text-sm text-muted">Every message hidden and person removed by the people leading a cause. You can undo any that still stand.</p>
      {actions.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-surface p-6 text-center text-sm text-muted">Nothing yet.</p>
      ) : (
        <ul className="space-y-3">
          {actions.map((a) => {
            const c = a.commentId ? comment.get(a.commentId) : undefined;
            const key = a.commentId ?? `${a.causeId}:${a.targetUserId}`;
            const first = !seen.has(key);
            seen.add(key);
            const undoHide = first && a.kind === "hide" && !!c?.hiddenByLeaderId;
            const undoBan = first && a.kind === "remove" && banned.has(`${a.causeId}:${a.targetUserId}`);
            return (
              <li key={a.id} className="rounded-xl border border-border bg-surface p-4 text-sm">
                <p>
                  <strong>{person.get(a.byUserId) ?? "Someone"}</strong> {ACTION_WORDS[a.kind] ?? a.kind} <strong>{person.get(a.targetUserId) ?? "someone"}</strong> in{" "}
                  <Link href={`/causes/${a.causeId}`} className="underline">
                    {cause.get(a.causeId) ?? "a cause"}
                  </Link>{" "}
                  <span className="text-xs text-muted">
                    <RelativeTime iso={a.createdAt.toISOString()} />
                  </span>
                </p>
                {c && <p className="mt-1 line-clamp-3 whitespace-pre-line text-xs text-muted">&ldquo;{c.body}&rdquo;</p>}
                {a.reason && <p className="mt-1 text-xs text-muted">Reason: &ldquo;{a.reason}&rdquo;</p>}
                {undoHide && (
                  <form action={undoLeaderHide} className="mt-2">
                    <input type="hidden" name="commentId" value={a.commentId!} />
                    <button className={buttonStyles.secondary}>Undo: show the message</button>
                  </form>
                )}
                {undoBan && (
                  <form action={liftCauseBan} className="mt-2">
                    <input type="hidden" name="causeId" value={a.causeId} />
                    <input type="hidden" name="userId" value={a.targetUserId} />
                    <button className={buttonStyles.secondary}>Undo: let them rejoin</button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

async function RecentlyRemoved() {
  const where = { removedAt: { gt: purgeCutoff() } };
  const author = { select: { name: true, email: true, deactivatedAt: true } };
  const [causes, comments] = await Promise.all([
    db.cause.findMany({ where, include: { author }, orderBy: { removedAt: "desc" }, take: 100 }),
    db.comment.findMany({
      where,
      include: { author, cause: { select: { id: true, title: true } } },
      orderBy: { removedAt: "desc" },
      take: 100,
    }),
  ]);
  const items = [
    ...causes.map((i) => ({ ...i, type: "cause" as const, text: i.title, on: null })),
    ...comments.map((c) => ({ ...c, type: "comment" as const, text: c.body, on: c.cause })),
  ].sort((a, b) => b.removedAt!.getTime() - a.removedAt!.getTime());

  return (
    <section className="mt-12">
      <h2 className="text-lg font-semibold tracking-tight">Recently removed</h2>
      <p className="mb-4 mt-1 text-sm text-muted">
        Removed content is only visible to its author, and is deleted for good {REMOVAL_RETENTION_DAYS} days after removal. Until
        then you can restore it.
      </p>
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-surface p-6 text-center text-sm text-muted">Nothing removed recently.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={`${item.type}:${item.id}`} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                <span className="rounded bg-border px-1.5 py-0.5 uppercase text-foreground">{item.type}</span>
                <span>
                  removed <RelativeTime iso={item.removedAt!.toISOString()} />
                </span>
                <span>· deleted for good <RelativeTime iso={permanentDeletionDate(item.removedAt!).toISOString()} /></span>
              </div>
              {item.on && <p className="mt-2 text-xs text-muted">on {item.on.title}</p>}
              <p className="mt-1 line-clamp-3 whitespace-pre-line text-sm">{item.text}</p>
              <p className="mt-1 text-xs text-muted">
                by {displayName(item.author)} ({item.author.email})
                {item.removalReason && <> · reason: “{item.removalReason}”</>}
              </p>
              <form action={restore} className="mt-3">
                <input type="hidden" name="targetType" value={item.type} />
                <input type="hidden" name="targetId" value={item.id} />
                <button className={buttonStyles.secondary}>Restore {kindLabel(item.type)}</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type CauseRow = Awaited<ReturnType<typeof loadCauses>>[number];
type CommentRow = Awaited<ReturnType<typeof loadComments>>[number];

function loadCauses(ids: string[]) {
  return db.cause.findMany({ where: { id: { in: ids } }, include: { author: { select: { name: true, email: true, deactivatedAt: true } } } });
}

function loadComments(ids: string[]) {
  return db.comment.findMany({
    where: { id: { in: ids } },
    include: { author: { select: { name: true, email: true, deactivatedAt: true } }, cause: { select: { id: true, title: true } } },
  });
}

function QueueList({
  list,
  causeById,
  commentById,
}: {
  list: Target[];
  causeById: Map<string, CauseRow>;
  commentById: Map<string, CommentRow>;
}) {
  return (
    <ul className="space-y-4">
      {list.map((t) => {
        const cause = t.type === "cause" ? causeById.get(t.id) : undefined;
        const comment = t.type === "comment" ? commentById.get(t.id) : undefined;
        const content = cause ?? comment;
        const reasons = t.reports.map((r) => r.reason).filter(Boolean);
        return (
          <li key={`${t.type}:${t.id}`} className="rounded-xl border border-border bg-surface p-5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded bg-border px-1.5 py-0.5 uppercase">{kindLabel(t.type)}</span>
              <span className="font-medium text-red-700 dark:text-red-400">
                {t.reports.length} report{t.reports.length === 1 ? "" : "s"}
              </span>
              {content?.hidden && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">Hidden</span>}
              <span className="text-muted">
                first reported <RelativeTime iso={t.reports[0].createdAt.toISOString()} />
              </span>
            </div>

            {!content ? (
              <p className="mt-3 text-sm text-muted">This content no longer exists.</p>
            ) : (
              <div className="mt-3 space-y-1">
                {cause && (
                  <Link href={`/causes/${cause.id}`} className="font-semibold hover:underline">
                    {cause.title}
                  </Link>
                )}
                {comment && (
                  <p className="text-xs text-muted">
                    on{" "}
                    <Link href={`/causes/${comment.cause.id}/chat`} className="underline">
                      {comment.cause.title}
                    </Link>
                  </p>
                )}
                <p className="line-clamp-4 whitespace-pre-line text-sm">{cause?.description ?? comment?.body}</p>
                <p className="text-xs text-muted">
                  by {displayName(content.author)} ({content.author.email})
                </p>
              </div>
            )}

            {reasons.length > 0 && (
              <ul className="mt-3 space-y-1 border-l-2 border-border pl-3 text-xs text-muted">
                {reasons.map((r, i) => (
                  <li key={i}>“{r}”</li>
                ))}
              </ul>
            )}

            <form action={moderate} className="mt-4 space-y-2">
              <input type="hidden" name="targetType" value={t.type} />
              <input type="hidden" name="targetId" value={t.id} />
              {content && (
                <input
                  name="reason"
                  maxLength={MAX_REMOVAL_REASON}
                  placeholder="Reason for removing (optional, shown to the author)"
                  aria-label="Reason for removing"
                  className={inputStyles}
                />
              )}
              <div className="flex flex-wrap gap-2">
                <button name="decision" value="kept" className={buttonStyles.secondary}>
                  {content?.hidden ? "Restore" : "Keep"} &amp; dismiss reports
                </button>
                {content && (
                  <button name="decision" value="removed" className={`${buttonStyles.secondary} text-red-700 dark:text-red-400`}>
                    Remove {kindLabel(t.type)}
                  </button>
                )}
              </div>
            </form>
          </li>
        );
      })}
    </ul>
  );
}
