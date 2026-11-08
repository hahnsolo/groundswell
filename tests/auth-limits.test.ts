import { describe, expect, it } from "vitest";
import {
  BETTER_AUTH_RATE_LIMIT_RULES,
  SIGN_IN_ACCOUNT_BLOCKED,
  SIGN_IN_ADDRESS_BLOCKED,
  SIGN_IN_PER_ACCOUNT,
  SIGN_IN_PER_ADDRESS,
  SIGN_UP_ADDRESS_BLOCKED,
  SIGN_UP_PER_ADDRESS,
  SOCIAL_ADDRESS_BLOCKED,
} from "@/lib/auth-limits";

const MINUTE = 60 * 1000;
const ROOM = 100;

describe("a room on one wifi network", () => {
  it("can all sign in within 15 minutes, with a retry each", () => {
    expect(SIGN_IN_PER_ADDRESS.windowMs).toBe(15 * MINUTE);
    expect(SIGN_IN_PER_ADDRESS.limit).toBeGreaterThanOrEqual(ROOM * 2);
  });

  it("can all sign up within an hour", () => {
    expect(SIGN_UP_PER_ADDRESS.windowMs).toBe(60 * MINUTE);
    expect(SIGN_UP_PER_ADDRESS.limit).toBeGreaterThanOrEqual(ROOM);
  });

  it("isn't stalled on the Google and Apple buttons", () => {
    const social = BETTER_AUTH_RATE_LIMIT_RULES["/sign-in/social"];
    expect(social.max).toBeGreaterThanOrEqual(ROOM);
    expect(social.window).toBeLessThanOrEqual(60);
  });
});

describe("password guessing", () => {
  it("is still held to 10 tries per account per 15 minutes", () => {
    expect(SIGN_IN_PER_ACCOUNT).toEqual({ limit: 10, windowMs: 15 * MINUTE });
  });

  it("stays tight on the public addresses, which have no per-account limit", () => {
    expect(BETTER_AUTH_RATE_LIMIT_RULES["/sign-in/email"]).toEqual({ window: 15 * 60, max: 20 });
    expect(BETTER_AUTH_RATE_LIMIT_RULES["/sign-up/email"]).toEqual({ window: 60 * 60, max: 10 });
  });
});

describe("what someone who is blocked reads", () => {
  it("says why it can happen and what to do now", () => {
    for (const message of [SIGN_IN_ADDRESS_BLOCKED, SIGN_UP_ADDRESS_BLOCKED, SOCIAL_ADDRESS_BLOCKED]) {
      expect(message).toMatch(/shared wifi/);
      expect(message).toMatch(/mobile data/);
    }
  });

  it("gives a wait that matches the limit", () => {
    expect(SIGN_IN_ADDRESS_BLOCKED).toMatch(/15 minutes/);
    expect(SIGN_UP_ADDRESS_BLOCKED).toMatch(/hour/);
    expect(SOCIAL_ADDRESS_BLOCKED).toMatch(/a minute/);
    expect(SIGN_IN_ACCOUNT_BLOCKED).toMatch(/15 minutes/);
  });

  it("doesn't promise that resetting a password lifts an account block", () => {
    expect(SIGN_IN_ACCOUNT_BLOCKED).not.toMatch(/Wait 15 minutes, or reset/);
    expect(SIGN_IN_ACCOUNT_BLOCKED).toMatch(/while you wait/);
  });
});
