import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/better-auth";
import { db } from "@/lib/db";
import { isPushEndpoint, MAX_DEVICES } from "@/lib/push-rules";

// This device's push subscription (#72): saved against the sign-in session, so
// signing out stops it. Only ever about the signed-in person's own devices.

const allowFake = process.env.NODE_ENV !== "production";

const subscription = z.object({
  endpoint: z.string().refine((e) => isPushEndpoint(e, allowFake), "Not a push service."),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

const signedIn = async () => auth.api.getSession({ headers: await headers() });

export async function POST(request: Request) {
  const session = await signedIn();
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const parsed = subscription.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "That isn't a push subscription." }, { status: 400 });
  const { endpoint, keys } = parsed.data;
  const data = { userId: session.user.id, sessionId: session.session.id, p256dh: keys.p256dh, auth: keys.auth };
  await db.pushSubscription.upsert({ where: { endpoint }, create: { endpoint, ...data }, update: data });
  // Keep the newest few.
  const old = await db.pushSubscription.findMany({ where: { userId: session.user.id }, orderBy: { createdAt: "desc" }, skip: MAX_DEVICES, select: { id: true } });
  if (old.length) await db.pushSubscription.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const session = await signedIn();
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { endpoint?: unknown } | null;
  if (typeof body?.endpoint !== "string") return NextResponse.json({ error: "Which device?" }, { status: 400 });
  await db.pushSubscription.deleteMany({ where: { endpoint: body.endpoint, userId: session.user.id } });
  return NextResponse.json({ ok: true });
}

/** How many of your devices are on (used to show the right state, and by the click-through checks). */
export async function GET() {
  const session = await signedIn();
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const subs = await db.pushSubscription.findMany({ where: { userId: session.user.id }, select: { endpoint: true } });
  return NextResponse.json({ endpoints: subs.map((s) => s.endpoint) });
}
