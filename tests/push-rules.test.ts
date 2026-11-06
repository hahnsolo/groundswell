import { describe, expect, it } from "vitest";
import { chooseChannel, isGoneStatus, isPushEndpoint, pushMessage } from "@/lib/push-rules";

describe("push vs email (#72)", () => {
  it("uses push where a device got it, email otherwise", () => {
    expect(chooseChannel(0, 0)).toBe("email");
    expect(chooseChannel(2, 1)).toBe("push");
    expect(chooseChannel(1, 0)).toBe("email"); // every device failed: fall back
  });

  it("forgets a device only when the push service says it's gone", () => {
    expect(isGoneStatus(404)).toBe(true);
    expect(isGoneStatus(410)).toBe(true);
    expect(isGoneStatus(429)).toBe(false);
    expect(isGoneStatus(500)).toBe(false);
    expect(isGoneStatus(undefined)).toBe(false);
  });
});

describe("where we'll send a push (#72)", () => {
  it("accepts the browsers' own push services", () => {
    for (const url of [
      "https://fcm.googleapis.com/fcm/send/abc",
      "https://updates.push.services.mozilla.com/wpush/v2/abc",
      "https://web.push.apple.com/abc",
      "https://wns2-par02p.notify.windows.com/w/?token=abc",
    ]) {
      expect(isPushEndpoint(url)).toBe(true);
    }
  });

  it("refuses anything else, so the server can't be pointed at another site", () => {
    for (const url of [
      "https://evil.example/x",
      "http://fcm.googleapis.com/fcm/send/abc",
      "https://fcm.googleapis.com.evil.example/x",
      "https://169.254.169.254/latest/meta-data",
      "https://localhost/x",
      "not a url",
      `https://fcm.googleapis.com/${"a".repeat(1100)}`,
    ]) {
      expect(isPushEndpoint(url)).toBe(false);
    }
  });

  it("allows the stand-in only when asked", () => {
    expect(isPushEndpoint("https://fake-push.test/x")).toBe(false);
    expect(isPushEndpoint("https://fake-push.test/x", true)).toBe(true);
  });
});

describe("what a notification says (#72)", () => {
  it("uses the subject and the first paragraph, without links", () => {
    expect(pushMessage("Tomorrow: Litter pick", 'A reminder that you\'re going.\nWhere: The gate\n\nThe details:\nhttps://x.example/e', "/events/1")).toEqual({
      title: "Tomorrow: Litter pick",
      body: "A reminder that you're going. Where: The gate",
      url: "/events/1",
    });
  });

  it("drops a first paragraph's link lines and keeps it short", () => {
    expect(pushMessage("S", "Hello\nhttps://x.example", "/").body).toBe("Hello");
    const long = pushMessage("S", "word ".repeat(100), "/");
    expect(long.body.length).toBeLessThanOrEqual(160);
    expect(long.body.endsWith("…")).toBe(true);
  });
});
