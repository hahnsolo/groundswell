import { describe, expect, it } from "vitest";
import { chatTokenExpiry, isRoomId, originAllowed, safeEqual, signChatToken, verifyChatToken } from "@/lib/chat-token";

const SECRET = "test-secret-that-is-long-enough";
const ROOM = "cmvww7nli0001dz6021oyv0hw";
const HOUR = 60 * 60 * 1000;
const NOON = Date.UTC(2026, 10, 1, 12, 0, 0);

describe("chat passes", () => {
  it("opens the room it was made for", async () => {
    const token = await signChatToken(SECRET, ROOM, NOON);
    expect(await verifyChatToken(SECRET, token, NOON)).toBe(ROOM);
  });

  it("lasts between 1 and 2 hours, and stays the same within the hour", async () => {
    expect(chatTokenExpiry(NOON)).toBe(NOON + 2 * HOUR);
    expect(chatTokenExpiry(NOON + 59 * 60 * 1000)).toBe(NOON + 2 * HOUR);
    expect(await signChatToken(SECRET, ROOM, NOON + 60_000)).toBe(await signChatToken(SECRET, ROOM, NOON + 50 * 60_000));
  });

  it("stops working once expired", async () => {
    const token = await signChatToken(SECRET, ROOM, NOON);
    expect(await verifyChatToken(SECRET, token, NOON + 2 * HOUR - 1)).toBe(ROOM);
    expect(await verifyChatToken(SECRET, token, NOON + 2 * HOUR)).toBeNull();
  });

  it("refuses passes signed with a different secret", async () => {
    const token = await signChatToken("someone-elses-secret", ROOM, NOON);
    expect(await verifyChatToken(SECRET, token, NOON)).toBeNull();
  });

  it("refuses a pass edited to point at another room", async () => {
    const token = await signChatToken(SECRET, ROOM, NOON);
    const [, signature] = token.split(".");
    const forged = btoa(JSON.stringify({ r: "anotherroom12345", e: NOON + 2 * HOUR })).replace(/=+$/, "");
    expect(await verifyChatToken(SECRET, `${forged}.${signature}`, NOON)).toBeNull();
  });

  it("refuses rubbish", async () => {
    for (const t of ["", ".", "abc", "a.b.c", "!!!.???"]) expect(await verifyChatToken(SECRET, t, NOON)).toBeNull();
  });

  it("only accepts sensible room ids", async () => {
    expect(isRoomId(ROOM)).toBe(true);
    expect(isRoomId("../admin")).toBe(false);
    expect(isRoomId("short")).toBe(false);
    await expect(signChatToken(SECRET, "../admin", NOON)).rejects.toThrow();
  });
});

describe("which sites may connect", () => {
  const live = "https://groundswell.hahnsolo.ca";
  const previews = "https://groundswell-*-hahnsolo.vercel.app";

  it("allows exact origins", () => {
    expect(originAllowed("https://groundswell.hahnsolo.ca", live)).toBe(true);
    expect(originAllowed("http://localhost:3000", `${live}, http://localhost:3000`)).toBe(true);
  });

  it("allows Vercel preview addresses by pattern", () => {
    expect(originAllowed("https://groundswell-4j933gigf-hahnsolo.vercel.app", previews)).toBe(true);
    expect(originAllowed("https://groundswell-git-12-live-chat-hahnsolo.vercel.app", previews)).toBe(true);
  });

  it("refuses look-alikes and missing origins", () => {
    expect(originAllowed("https://groundswell.hahnsolo.ca.evil.test", live)).toBe(false);
    expect(originAllowed("https://evilgroundswell.hahnsolo.ca", live)).toBe(false);
    expect(originAllowed("https://groundswell-x-hahnsolo.vercel.app.evil.test", previews)).toBe(false);
    expect(originAllowed("https://groundswell-a.b-hahnsolo.vercel.app", previews)).toBe(false);
    expect(originAllowed(null, live)).toBe(false);
  });
});

describe("safeEqual", () => {
  it("compares strings", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});
