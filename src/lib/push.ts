import "server-only";
import webpush from "web-push";
import { db } from "./db";
import { FAKE_PUSH_ORIGIN, isGoneStatus } from "./push-rules";

// Sends web push (#72). Needs a key pair in VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY
// (docs/keys-and-secrets.md). Without them push is simply off and everyone gets email.

const site = () => {
  const app = process.env.APP_URL ?? "";
  return app.startsWith("https://") ? app : "https://groundswell.hahnsolo.ca";
};

export const pushPublicKey = () => (process.env.VAPID_PRIVATE_KEY && process.env.VAPID_PUBLIC_KEY ? process.env.VAPID_PUBLIC_KEY : null);

export type PushMessage = { title: string; body: string; url: string };

async function sendOne(sub: { endpoint: string; p256dh: string; auth: string }, payload: string): Promise<number> {
  if (process.env.NODE_ENV !== "production" && sub.endpoint.startsWith(FAKE_PUSH_ORIGIN)) {
    const gone = sub.endpoint.includes("/gone");
    console.log(`[fake push] ${gone ? "410 gone" : "delivered"}: ${payload}`);
    return gone ? 410 : 201;
  }
  const publicKey = pushPublicKey();
  if (!publicKey) return 0;
  const res = await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, {
    TTL: 24 * 60 * 60,
    vapidDetails: { subject: site(), publicKey, privateKey: process.env.VAPID_PRIVATE_KEY! },
  });
  return res.statusCode;
}

/** Sends to all of someone's devices. Returns how many it reached; devices gone for good are forgotten. */
export async function sendPush(userId: string, message: PushMessage) {
  const subs = await db.pushSubscription.findMany({ where: { userId, session: { expiresAt: { gt: new Date() } } }, select: { id: true, endpoint: true, p256dh: true, auth: true } });
  if (subs.length === 0) return { devices: 0, delivered: 0 };
  const payload = JSON.stringify(message);
  let delivered = 0;
  for (const sub of subs) {
    let status: number | undefined;
    try {
      status = await sendOne(sub, payload);
    } catch (e) {
      status = (e as { statusCode?: number }).statusCode;
      if (!isGoneStatus(status)) console.warn("Push failed:", status ?? (e as Error).message);
    }
    if (isGoneStatus(status)) await db.pushSubscription.deleteMany({ where: { id: sub.id } });
    else if (status && status >= 200 && status < 300) delivered++;
  }
  return { devices: subs.length, delivered };
}
