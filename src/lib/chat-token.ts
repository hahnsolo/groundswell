// Short-lived passes for the live chat server (realtime/). The site hands one
// to each person allowed to read a cause's chat; the chat server checks it
// before letting their browser listen for "something changed" pings.
//
// Shared by both sides, so it only uses Web Crypto (the same in Node and on
// Cloudflare) and has no other imports.

const enc = new TextEncoder();
const HOUR = 60 * 60 * 1000;

/**
 * Passes expire at the end of the next whole hour (between 1 and 2 hours from
 * now). Rounding keeps the pass identical across page refreshes within the
 * hour, so a refresh doesn't drop and reopen the live connection.
 */
export function chatTokenExpiry(now = Date.now()) {
  return (Math.floor(now / HOUR) + 2) * HOUR;
}

const ROOM_ID = /^[A-Za-z0-9]{8,40}$/;
export const isRoomId = (s: string) => ROOM_ID.test(s);

function b64url(bytes: Uint8Array) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string) {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function sign(secret: string, data: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data))));
}

/** Compares without leaking, through timing, how much of a guess was right. */
export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** A pass to listen to one cause's chat. */
export async function signChatToken(secret: string, room: string, now = Date.now()) {
  if (!isRoomId(room)) throw new Error("bad room id");
  const payload = b64url(enc.encode(JSON.stringify({ r: room, e: chatTokenExpiry(now) })));
  return `${payload}.${await sign(secret, payload)}`;
}

/** The room a pass is for, or null if it's forged, damaged or expired. */
export async function verifyChatToken(secret: string, token: string, now = Date.now()): Promise<string | null> {
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) return null;
  if (!safeEqual(signature, await sign(secret, payload))) return null;
  try {
    const { r, e } = JSON.parse(new TextDecoder().decode(fromB64url(payload)));
    if (typeof r !== "string" || !isRoomId(r) || typeof e !== "number" || e <= now) return null;
    return r;
  } catch {
    return null;
  }
}

/**
 * Whether a browser on `origin` may connect. `allowed` is a comma-separated
 * list of origins, where `*` stands for one run of letters, digits and dashes
 * (for Vercel preview addresses).
 */
export function originAllowed(origin: string | null, allowed: string) {
  if (!origin) return false;
  return allowed
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .some((p) => new RegExp(`^${p.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[a-z0-9-]+")}$`).test(origin));
}
