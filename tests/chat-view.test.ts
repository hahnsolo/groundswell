import { describe, expect, it } from "vitest";
import { chatMessageView, readAfter, withArrivals, type ChatCause, type ChatMessageRow, type ChatMessageView } from "@/lib/chat-view";
import { FORMER_MEMBER } from "@/lib/accounts";
import { A_NEIGHBOUR } from "@/lib/member-list";

const cause: ChatCause = { id: "cause1", authorId: "starter", leaderId: "leader", coLeaders: [{ userId: "co", acceptedAt: new Date(0), createdAt: new Date(0) }] };
const now = Date.UTC(2026, 10, 7, 12);

function row(over: Partial<ChatMessageRow> & { authorId?: string; showName?: boolean; isAdmin?: boolean; deactivatedAt?: Date | null } = {}): ChatMessageRow {
  const { authorId = "sam", showName = true, isAdmin = false, deactivatedAt = null, ...rest } = over;
  return {
    id: "m1",
    body: "Hello neighbours",
    createdAt: new Date(now - 60_000),
    editedAt: null,
    hidden: false,
    removedAt: null,
    removalReason: null,
    hiddenByLeaderId: null,
    author: { id: authorId, name: authorId === "sam" ? "Sam Lee" : authorId, deactivatedAt, showName, isAdmin },
    ...rest,
  };
}

const member = { id: "alex", emailVerified: true };
const leader = { id: "leader", emailVerified: true };

describe("chatMessageView", () => {
  it("is plain data a browser can take", () => {
    const v = chatMessageView(row(), cause, member, now);
    expect(JSON.parse(JSON.stringify(v))).toEqual(v);
  });

  it("names people by their setting, except to the people leading and moderators", () => {
    const shy = row({ showName: false });
    expect(chatMessageView(shy, cause, member, now).name).toBe(A_NEIGHBOUR);
    expect(chatMessageView(shy, cause, leader, now).name).toBe("Sam Lee");
    expect(chatMessageView(shy, cause, { id: "mod", isAdmin: true }, now).name).toBe("Sam Lee");
    expect(chatMessageView(row({ deactivatedAt: new Date(0) }), cause, leader, now).name).toBe(FORMER_MEMBER);
  });

  it("shows who leads, co-leads and started it", () => {
    expect(chatMessageView(row({ authorId: "leader" }), cause, member, now).role).toBe("leads this");
    expect(chatMessageView(row({ authorId: "co" }), cause, member, now).role).toBe("co-leads this");
    expect(chatMessageView(row({ authorId: "starter" }), cause, member, now).role).toBe("started this");
    expect(chatMessageView(row(), cause, member, now).role).toBeNull();
  });

  it("never sends the words of a message hidden by the people leading, except to its author", () => {
    const hidden = row({ hidden: true, hiddenByLeaderId: "leader" });
    const toOthers = chatMessageView(hidden, cause, member, now);
    expect(toOthers.placeholder).toBe(true);
    expect(toOthers.body).toBe("");
    expect(JSON.stringify(toOthers)).not.toContain("Hello neighbours");
    const toAuthor = chatMessageView(hidden, cause, { id: "sam", emailVerified: true }, now);
    expect(toAuthor.placeholder).toBe(false);
    expect(toAuthor.body).toBe("Hello neighbours");
  });

  it("gives the right menu to each viewer", () => {
    const own = chatMessageView(row(), cause, { id: "sam", emailVerified: true }, now);
    expect(own).toMatchObject({ mine: true, canEdit: true, canReport: false, canHide: false, remove: null });
    const other = chatMessageView(row(), cause, member, now);
    expect(other).toMatchObject({ mine: false, canEdit: false, canReport: true, canHide: false, remove: null });
    const lead = chatMessageView(row(), cause, leader, now);
    expect(lead).toMatchObject({ canHide: true, canReport: false, remove: { causeId: "cause1", userId: "sam", name: "Sam Lee" } });
    expect(chatMessageView(row({ hidden: true, hiddenByLeaderId: "leader" }), cause, leader, now).canUnhide).toBe(true);
    expect(chatMessageView(row(), cause, { id: "alex", emailVerified: false }, now).canReport).toBe(false);
  });

  it("stops editing after 15 minutes", () => {
    expect(chatMessageView(row({ createdAt: new Date(now - 16 * 60_000) }), cause, { id: "sam" }, now).canEdit).toBe(false);
  });

  it("carries the removal reason only when removed", () => {
    expect(chatMessageView(row({ removalReason: "stale" }), cause, member, now).removalReason).toBeNull();
    expect(chatMessageView(row({ removedAt: new Date(now), removalReason: "Rude" }), cause, { id: "sam" }, now)).toMatchObject({ removalReason: "Rude" });
  });
});

describe("readAfter", () => {
  it("reads the newest message an open chat has", () => {
    expect(readAfter(new URLSearchParams("after=abc123&at=2026-11-07T12:00:00.000Z"))).toEqual({ id: "abc123", createdAt: new Date("2026-11-07T12:00:00.000Z") });
  });
  it("refuses anything else", () => {
    expect(readAfter(new URLSearchParams("after=abc123"))).toBeNull();
    expect(readAfter(new URLSearchParams("after=a%27%20OR%201&at=2026-11-07T12:00:00Z"))).toBeNull();
    expect(readAfter(new URLSearchParams("after=abc&at=yesterday"))).toBeNull();
  });
});

describe("withArrivals", () => {
  const msg = (id: string, minute: number) => ({ id, createdAt: new Date(Date.UTC(2026, 10, 7, 12, minute)).toISOString() }) as ChatMessageView;
  const page = [msg("a", 1), msg("b", 2)];

  it("adds new messages after the page's", () => {
    expect(withArrivals(page, [msg("c", 3)]).map((m) => m.id)).toEqual(["a", "b", "c"]);
  });
  it("drops repeats and anything the page already covers, as after a reload", () => {
    expect(withArrivals(page, [msg("b", 2), msg("x", 0)]).map((m) => m.id)).toEqual(["a", "b"]);
    expect(withArrivals(page, [msg("b", 2)])).toBe(page);
  });
  it("works on an empty chat", () => {
    expect(withArrivals([], [msg("a", 1)]).map((m) => m.id)).toEqual(["a"]);
  });
});
