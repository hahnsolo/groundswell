// Push notifications (#72): standard web push, no paid service. The same kinds
// and settings as emails decide who hears about what; these rules decide how.
// Pure, so it's easy to test; the sending is in ./push.ts.

/** The browsers' own push services. We only ever send to these (a subscription's address comes from the browser, so it's checked). */
const PUSH_HOSTS = ["fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com", "notify.windows.com"];
const PUSH_HOST_ENDINGS = [".push.services.mozilla.com", ".notify.windows.com", ".push.apple.com"];

/** A stand-in for the click-through checks: delivers (or, with /gone, reports the device gone) without a real push service. Never in production. */
export const FAKE_PUSH_ORIGIN = "https://fake-push.test/";

export function isPushEndpoint(url: string, allowFake = false) {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" || url.length > 1000) return false;
  if (allowFake && url.startsWith(FAKE_PUSH_ORIGIN)) return true;
  return PUSH_HOSTS.includes(u.hostname) || PUSH_HOST_ENDINGS.some((e) => u.hostname.endsWith(e));
}

/** Push first where they have it on; email otherwise (and when no device could be reached). */
export function chooseChannel(devices: number, delivered: number): "push" | "email" {
  return devices > 0 && delivered > 0 ? "push" : "email";
}

/** A device has gone away for good: stop sending to it. */
export const isGoneStatus = (status: number | undefined) => status === 404 || status === 410;

/** What a notification says: the subject, and the email's first paragraph without links. */
export function pushMessage(subject: string, body: string, url: string) {
  const firstPara = body.split(/\n\s*\n/)[0] ?? "";
  const text = firstPara
    .split("\n")
    .filter((l) => !/^https?:\/\//.test(l.trim()))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return { title: subject.slice(0, 80), body: text.length > 160 ? `${text.slice(0, 159).trimEnd()}…` : text, url };
}

/** The most devices one person keeps on at once. */
export const MAX_DEVICES = 10;
