import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "./better-auth";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  homeCountry: string | null;
  homePostal: string | null;
  emailVerified: boolean;
  isAdmin: boolean;
  createdAt: Date;
};

/** The signed-in user, or null. Deduplicated per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const u = session.user;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    homeCountry: u.homeCountry ?? null,
    homePostal: u.homePostal ?? null,
    emailVerified: u.emailVerified,
    isAdmin: !!u.isAdmin,
    createdAt: new Date(u.createdAt),
  };
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

/** Only allow same-site relative redirects after sign-in. */
export function safeNext(next: unknown) {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}
