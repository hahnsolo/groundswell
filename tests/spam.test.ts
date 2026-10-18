import { describe, expect, it } from "vitest";
import type { CurrentUser } from "@/lib/auth";
import { honeypotTripped, HONEYPOT_FIELD, linkError } from "@/lib/spam";

const HOUR = 60 * 60 * 1000;

function user(ageHours: number): CurrentUser {
  return {
    id: "u1",
    name: "Test",
    email: "test@example.test",
    homeCountry: null,
    homePostal: null,
    emailVerified: true,
    isAdmin: false,
    createdAt: new Date(Date.now() - ageHours * HOUR),
  };
}

describe("links in posts", () => {
  it("blocks any link from accounts under a day old", () => {
    expect(linkError(user(2), "see https://example.com")).toMatch(/New accounts/);
    expect(linkError(user(2), "see www.example.com")).toMatch(/New accounts/);
    expect(linkError(user(2), "no links here")).toBeNull();
  });

  it("allows up to 3 links for established accounts", () => {
    const three = "https://a.test https://b.test https://c.test";
    expect(linkError(user(48), three)).toBeNull();
    expect(linkError(user(48), `${three} https://d.test`)).toMatch(/at most 3/);
  });

  it("counts links across all the fields of a post", () => {
    expect(linkError(user(48), "https://a.test https://b.test", "https://c.test https://d.test")).toMatch(/at most 3/);
    expect(linkError(user(48), undefined, null, "https://a.test")).toBeNull();
  });
});

describe("honeypot", () => {
  it("trips only when the hidden field is filled in", () => {
    const form = new FormData();
    expect(honeypotTripped(form)).toBe(false);
    form.set(HONEYPOT_FIELD, "   ");
    expect(honeypotTripped(form)).toBe(false);
    form.set(HONEYPOT_FIELD, "https://spam.test");
    expect(honeypotTripped(form)).toBe(true);
  });
});
