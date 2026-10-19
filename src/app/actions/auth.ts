"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { APIError } from "better-auth/api";
import { db } from "@/lib/db";
import { auth } from "@/lib/better-auth";
import { verifyPassword } from "better-auth/crypto";
import { getCurrentUser, requireUser, safeNext } from "@/lib/auth";
import { deactivateAccount } from "@/lib/leaving";
import { clientIp, HOUR, MINUTE, rateLimit } from "@/lib/rate-limit";
import { BOT_CHECK_ERROR, honeypotTripped, verifyHuman } from "@/lib/spam";
import { fromZodError, type FormState } from "@/lib/forms";
import { parsePostal } from "@/lib/countries";

// Better Auth guards its own HTTP endpoints (rate limits + Turnstile plugin).
// These Server Actions call it directly, so they run the same checks here.

function authErrorCode(e: unknown) {
  return e instanceof APIError ? String((e.body as { code?: string } | undefined)?.code ?? "") : "";
}

const signUpSchema = z.object({
  name: z.string().trim().min(2, "Tell us what to call you.").max(60),
  email: z.string().trim().toLowerCase().email("Enter a valid email."),
  password: z.string().min(10, "Use at least 10 characters.").max(128),
  country: z.string().optional(),
  postal: z.string().optional(),
});

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  if (honeypotTripped(formData)) return { error: "Something went wrong. Please try again." };
  if (!(await rateLimit(`signup:${await clientIp()}`, 10, HOUR))) {
    return { error: "Too many sign-up attempts. Try again later." };
  }
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  if (!(await verifyHuman(formData))) return { error: BOT_CHECK_ERROR };
  const { name, email, password, country, postal } = parsed.data;

  let home: { homeCountry: string; homePostal: string } | undefined;
  if (country && postal?.trim()) {
    const p = parsePostal(country, postal);
    if (!p.ok) return { fieldErrors: { postal: [p.error] } };
    home = { homeCountry: p.country.code, homePostal: p.postal };
  }

  try {
    const { user } = await auth.api.signUpEmail({
      body: { name, email, password, callbackURL: "/me?verified=1" },
      headers: await headers(),
    });
    if (home) await db.user.update({ where: { id: user.id }, data: home });
  } catch (e) {
    if (authErrorCode(e).startsWith("USER_ALREADY_EXISTS")) {
      return { fieldErrors: { email: ["An account with this email already exists. Try signing in."] } };
    }
    console.error("Sign-up failed", e);
    return { error: "We couldn't create your account. Please try again." };
  }
  redirect(safeNext(formData.get("next")));
}

const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email."),
  password: z.string().min(1, "Enter your password."),
});

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await rateLimit(`signin:${await clientIp()}`, 20, 15 * MINUTE))) {
    return { error: "Too many attempts. Wait a few minutes and try again." };
  }
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  // Per-account limit too, so password guessing spread across many IPs still stalls.
  if (!(await rateLimit(`signin-account:${parsed.data.email}`, 10, 15 * MINUTE))) {
    return { error: "Too many attempts for this account. Wait 15 minutes, or reset your password." };
  }
  if (!(await verifyHuman(formData))) return { error: BOT_CHECK_ERROR };
  // Signing in during the grace period restores a deleted account (see the
  // session hook in better-auth.ts); remember so we can say so.
  const returning = await db.user.findFirst({
    where: { email: parsed.data.email, deactivatedAt: { not: null }, anonymizedAt: null },
    select: { id: true },
  });

  try {
    await auth.api.signInEmail({ body: parsed.data, headers: await headers() });
  } catch (e) {
    if (authErrorCode(e) === "INVALID_EMAIL_OR_PASSWORD" || (e instanceof APIError && e.statusCode === 401)) {
      return {
        error: "That email and password don't match. If you joined with Google or Apple, use that button instead.",
      };
    }
    console.error("Sign-in failed", e);
    return { error: "We couldn't sign you in. Please try again." };
  }
  redirect(returning ? "/me?restored=1" : safeNext(formData.get("next")));
}

export async function signOut() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/");
}

// ---------- Delete my account ----------
// Deactivates now; signing back in within the grace period restores it, and
// after that the daily job anonymizes it (src/lib/leaving.ts).

export async function deleteAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("/me");
  if (!(await rateLimit(`delete-account:${user.id}`, 5, HOUR))) {
    return { error: "Too many attempts. Try again in an hour." };
  }
  // Prove it's really them: their password, or for Google/Apple-only accounts, typing DELETE.
  const credential = await db.account.findFirst({
    where: { userId: user.id, providerId: "credential" },
    select: { password: true },
  });
  if (credential?.password) {
    const password = formData.get("password");
    if (typeof password !== "string" || !(await verifyPassword({ hash: credential.password, password }))) {
      return { fieldErrors: { password: ["That password isn't right."] } };
    }
  } else if (String(formData.get("confirm") ?? "").trim().toUpperCase() !== "DELETE") {
    return { fieldErrors: { confirm: ["Type DELETE to confirm."] } };
  }

  // Sign this browser out first (clears the cookie), then everything else.
  await auth.api.signOut({ headers: await headers() }).catch(() => {});
  await deactivateAccount(user.id);
  redirect("/goodbye");
}

// ---------- Email verification ----------
// The emailed link goes to Better Auth (/api/auth/verify-email), which marks
// the email verified and redirects to /me?verified=1.

export async function resendVerification(): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in first." };
  if (user.emailVerified) return { ok: true };
  if (!(await rateLimit(`verify-resend:${user.id}`, 3, HOUR))) {
    return { error: "We've sent a few already — check your spam folder, or try again in an hour." };
  }
  try {
    await auth.api.sendVerificationEmail({
      body: { email: user.email, callbackURL: "/me?verified=1" },
      headers: await headers(),
    });
  } catch (e) {
    console.error("Resend verification failed", e);
    return { error: "We couldn't send the email. Please try again shortly." };
  }
  return { ok: true };
}

// ---------- Password reset ----------
// The emailed link goes to Better Auth, which checks the token and redirects
// to /reset-password?token=… (or ?error=INVALID_TOKEN).

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z.string().trim().toLowerCase().email().safeParse(formData.get("email"));
  if (!parsed.success) return { fieldErrors: { email: ["Enter a valid email."] } };
  if (
    !(await rateLimit(`reset:${await clientIp()}`, 5, HOUR)) ||
    !(await rateLimit(`reset-account:${parsed.data}`, 3, HOUR))
  ) {
    return { error: "Too many reset requests. Try again later." };
  }
  if (!(await verifyHuman(formData))) return { error: BOT_CHECK_ERROR };
  try {
    await auth.api.requestPasswordReset({
      body: { email: parsed.data, redirectTo: "/reset-password" },
      headers: await headers(),
    });
  } catch (e) {
    console.error("Reset request failed", e);
  }
  // Same response whether or not the account exists, so emails can't be probed.
  return { ok: true };
}

const resetSchema = z
  .object({
    token: z.string().min(1),
    password: z.string().min(10, "Use at least 10 characters.").max(128),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: "Passwords don't match.", path: ["confirm"] });

export async function resetPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = resetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  try {
    // Also signs the account out on every device (revokeSessionsOnPasswordReset).
    await auth.api.resetPassword({
      body: { newPassword: parsed.data.password, token: parsed.data.token },
      headers: await headers(),
    });
  } catch (e) {
    if (authErrorCode(e) === "INVALID_TOKEN") {
      return { error: "This reset link is invalid or has expired. Request a new one." };
    }
    console.error("Password reset failed", e);
    return { error: "We couldn't reset your password. Please try again." };
  }
  redirect("/signin?reset=1");
}
