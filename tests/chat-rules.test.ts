import { describe, expect, it } from "vitest";
import { canReadChat, chatAccess } from "@/lib/chat-rules";

const HOUR = 60 * 60 * 1000;
const now = new Date("2026-10-20T12:00:00Z");
const hoursAgo = (n: number) => new Date(now.getTime() - n * HOUR);
const member = { signedIn: true, emailVerified: true };

describe("cause chat access", () => {
  it("is hidden from people who aren't signed in", () => {
    const a = chatAccess({ signedIn: false, joinedAt: null }, now);
    expect(a).toEqual({ kind: "sign-in" });
    expect(canReadChat(a)).toBe(false);
  });

  it("asks signed-in people to join before they can see it", () => {
    const a = chatAccess({ ...member, joinedAt: null }, now);
    expect(a).toEqual({ kind: "join" });
    expect(canReadChat(a)).toBe(false);
  });

  it("lets new members read but not post for 24 hours", () => {
    const a = chatAccess({ ...member, joinedAt: hoursAgo(2) }, now);
    expect(a).toEqual({ kind: "read", canPostAt: hoursAgo(-22) });
    expect(canReadChat(a)).toBe(true);
  });

  it("lets members post once the 24 hours are up", () => {
    expect(chatAccess({ ...member, joinedAt: hoursAgo(24) }, now)).toEqual({ kind: "post" });
    expect(chatAccess({ ...member, joinedAt: hoursAgo(200) }, now)).toEqual({ kind: "post" });
  });

  it("lets the person who raised the cause post straight away", () => {
    expect(chatAccess({ ...member, isAuthor: true, joinedAt: hoursAgo(0) }, now)).toEqual({ kind: "post" });
  });

  it("still needs a confirmed email to post", () => {
    expect(chatAccess({ signedIn: true, emailVerified: false, joinedAt: hoursAgo(48) }, now)).toEqual({ kind: "verify-email" });
  });

  it("lets admins read without joining (to moderate), but not post", () => {
    const a = chatAccess({ ...member, isAdmin: true, joinedAt: null }, now);
    expect(a.kind).toBe("read");
    expect(canReadChat(a)).toBe(true);
  });
});
