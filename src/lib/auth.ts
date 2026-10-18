import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import { db } from "./db";

export { hashPassword, verifyPassword } from "./password";

const COOKIE_NAME = "gs_session";
const SESSION_DAYS = 30;

// ---- Sessions (random token in an httpOnly cookie, sha256 of it in the DB) ----

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.session.create({ data: { id: hashToken(token), userId, expiresAt } });
  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (token) await db.session.deleteMany({ where: { id: hashToken(token) } });
  store.delete(COOKIE_NAME);
}

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  homeCountry: string | null;
  homePostal: string | null;
  emailVerified: boolean;
  isAdmin: boolean;
};

/** The signed-in user, or null. Deduplicated per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { id: hashToken(token) },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          homeCountry: true,
          homePostal: true,
          emailVerifiedAt: true,
          isAdmin: true,
        },
      },
    },
  });
  if (!session || session.expiresAt < new Date()) return null;
  const { emailVerifiedAt, ...user } = session.user;
  return { ...user, emailVerified: !!emailVerifiedAt };
});

/** For pages and actions that need a user: redirects to sign-in otherwise. */
export async function requireUser(returnTo?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(returnTo ? `/signin?next=${encodeURIComponent(returnTo)}` : "/signin");
  return user;
}

export const UNVERIFIED_ERROR = "Confirm your email address first — check your inbox for the link.";

/** For admin-only pages and actions. Non-admins get a 404, not a hint. */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.isAdmin) notFound();
  return user;
}

/** Sign out everywhere (used after a password reset). */
export async function destroyAllSessions(userId: string) {
  await db.session.deleteMany({ where: { userId } });
}

/** Only allow same-site relative redirects after sign-in. */
export function safeNext(next: unknown) {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}
