import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { catchUpLimit, deliver, mailServices, parseMailFrom } from "../src/lib/mail-send";

const email = { to: "sam@example.test", subject: "Hello", text: "Hi Sam" };
const from = "Groundswell <no-reply@groundswell.example.test>";
const keys = { BREVO_API_KEY: "brevo-key", RESEND_API_KEY: "resend-key" };

function fakeFetch(answers: Record<string, number | "down">) {
  const calls: { host: string; init: RequestInit }[] = [];
  const doFetch = (async (url: string, init: RequestInit) => {
    const host = new URL(url).host;
    calls.push({ host, init });
    const answer = answers[host];
    if (answer === "down") throw new Error("connection failed");
    return new Response("{}", { status: answer });
  }) as unknown as typeof fetch;
  return { doFetch, calls };
}

const BREVO = "api.brevo.com";
const RESEND = "api.resend.com";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("parseMailFrom", () => {
  it("reads a name and address", () => expect(parseMailFrom(from)).toEqual({ name: "Groundswell", address: "no-reply@groundswell.example.test" }));
  it("reads a bare address", () => expect(parseMailFrom(" a@b.c ")).toEqual({ address: "a@b.c" }));
  it.each(["", "Groundswell", "Groundswell <a@b.c", "a b@c.d", "<a@b.c>"])("refuses %j", (bad) => expect(parseMailFrom(bad)).toBeNull());
});

describe("mailServices", () => {
  it("tries Brevo first, then Resend", () => expect(mailServices(keys).map((s) => s.name)).toEqual(["Brevo", "Resend"]));
  it("works with Resend alone, as the live site does until Brevo is set up", () => expect(mailServices({ RESEND_API_KEY: "k" }).map((s) => s.name)).toEqual(["Resend"]));
  it("has none without keys", () => expect(mailServices({})).toEqual([]));
});

describe("deliver", () => {
  it("stops at the first service that takes it", async () => {
    const { doFetch, calls } = fakeFetch({ [BREVO]: 201, [RESEND]: 200 });
    await expect(deliver(email, mailServices(keys, doFetch), from)).resolves.toBe("Brevo");
    expect(calls.map((c) => c.host)).toEqual([BREVO]);
  });

  it("moves on when the free allowance has run out", async () => {
    const { doFetch } = fakeFetch({ [BREVO]: 429, [RESEND]: 200 });
    await expect(deliver(email, mailServices(keys, doFetch), from)).resolves.toBe("Resend");
  });

  it("moves on when a service is down", async () => {
    const { doFetch } = fakeFetch({ [BREVO]: "down", [RESEND]: 200 });
    await expect(deliver(email, mailServices(keys, doFetch), from)).resolves.toBe("Resend");
  });

  it("fails when none takes it", async () => {
    const { doFetch } = fakeFetch({ [BREVO]: 429, [RESEND]: 429 });
    await expect(deliver(email, mailServices(keys, doFetch), from)).rejects.toThrow("couldn't send");
  });

  it("sends Brevo what it expects", async () => {
    const { doFetch, calls } = fakeFetch({ [BREVO]: 201 });
    await deliver({ ...email, headers: { "X-Test": "1" } }, mailServices({ BREVO_API_KEY: "brevo-key" }, doFetch), from);
    expect((calls[0].init.headers as Record<string, string>)["api-key"]).toBe("brevo-key");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      sender: { name: "Groundswell", email: "no-reply@groundswell.example.test" },
      to: [{ email: "sam@example.test" }],
      subject: "Hello",
      textContent: "Hi Sam",
      headers: { "X-Test": "1" },
    });
  });

  it("sends Resend what it expects", async () => {
    const { doFetch, calls } = fakeFetch({ [RESEND]: 200 });
    await deliver(email, mailServices({ RESEND_API_KEY: "resend-key" }, doFetch), from);
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe("Bearer resend-key");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ from, to: "sam@example.test", subject: "Hello", text: "Hi Sam" });
  });
});

describe("catchUpLimit", () => {
  it("leaves half of the day's allowance free", () => expect(catchUpLimit(mailServices(keys))).toBe(200));
  it("shrinks with Resend alone", () => expect(catchUpLimit(mailServices({ RESEND_API_KEY: "k" }))).toBe(50));
  it("is zero with no services", () => expect(catchUpLimit([])).toBe(0));
});
