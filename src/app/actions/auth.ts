"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  createSession,
  destroyAllSessions,
  destroySession,
  getCurrentUser,
  hashPassword,
  safeNext,
  verifyPassword,
} from "@/lib/auth";
import { consumeToken, sendPasswordResetEmail, sendVerificationEmail } from "@/lib/tokens";
import { rateLimit } from "@/lib/rate-limit";
import { fromZodError, type FormState } from "@/lib/forms";
import { parsePostal } from "@/lib/countries";

async function clientKey(prefix: string) {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  return `${prefix}:${ip}`;
}

const signUpSchema = z.object({
  name: z.string().trim().min(2, "Tell us what to call you.").max(60),
  email: z.string().trim().toLowerCase().email("Enter a valid email."),
  password: z.string().min(10, "Use at least 10 characters.").max(200),
  country: z.string().optional(),
  postal: z.string().optional(),
});

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!rateLimit(await clientKey("signup"), 10, 60 * 60 * 1000)) {
    return { error: "Too many sign-up attempts. Try again later." };
  }
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  const { name, email, password, country, postal } = parsed.data;

  let home: { homeCountry: string; homePostal: string } | undefined;
  if (country && postal?.trim()) {
    const p = parsePostal(country, postal);
    if (!p.ok) return { fieldErrors: { postal: [p.error] } };
    home = { homeCountry: p.country.code, homePostal: p.postal };
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return { fieldErrors: { email: ["An account with this email already exists."] } };

  const user = await db.user.create({
    data: { name, email, passwordHash: await hashPassword(password), ...home },
  });
  await createSession(user.id);
  try {
    await sendVerificationEmail(user);
  } catch (err) {
    // Don't block sign-up on email trouble; they can resend from the banner.
    console.error("Verification email failed", err);
  }
  redirect(safeNext(formData.get("next")));
}

const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email."),
  password: z.string().min(1, "Enter your password."),
});

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!rateLimit(await clientKey("signin"), 20, 15 * 60 * 1000)) {
    return { error: "Too many attempts. Wait a few minutes and try again." };
  }
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return { error: "That email and password don't match." };
  }
  await createSession(user.id);
  redirect(safeNext(formData.get("next")));
}

export async function signOut() {
  await destroySession();
  redirect("/");
}

// ---------- Email verification ----------

export async function resendVerification(): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in first." };
  if (user.emailVerified) return { ok: true };
  if (!rateLimit(`verify-resend:${user.id}`, 3, 60 * 60 * 1000)) {
    return { error: "We've sent a few already — check your spam folder, or try again in an hour." };
  }
  try {
    await sendVerificationEmail(user);
  } catch (e) {
    return { error: (e as Error).message };
  }
  return { ok: true };
}

export async function verifyEmail(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = String(formData.get("token") ?? "");
  const userId = token && (await consumeToken(token, "verify_email"));
  if (!userId) return { error: "This link is invalid or has expired. Sign in and request a new one." };
  await db.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
  // Re-render the shared layout too, so the "confirm your email" banner goes away.
  refresh();
  redirect("/me?verified=1");
}

// ---------- Password reset ----------

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z.string().trim().toLowerCase().email().safeParse(formData.get("email"));
  if (!parsed.success) return { fieldErrors: { email: ["Enter a valid email."] } };
  if (!rateLimit(await clientKey("reset"), 5, 60 * 60 * 1000) || !rateLimit(`reset:${parsed.data}`, 3, 60 * 60 * 1000)) {
    return { error: "Too many reset requests. Try again later." };
  }
  const user = await db.user.findUnique({ where: { email: parsed.data } });
  if (user) {
    try {
      await sendPasswordResetEmail(user);
    } catch (err) {
      console.error("Reset email failed", err);
    }
  }
  // Same response whether or not the account exists, so emails can't be probed.
  return { ok: true };
}

const resetSchema = z
  .object({
    token: z.string().min(1),
    password: z.string().min(10, "Use at least 10 characters.").max(200),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: "Passwords don't match.", path: ["confirm"] });

export async function resetPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = resetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  const userId = await consumeToken(parsed.data.token, "reset_password");
  if (!userId) return { error: "This reset link is invalid or has expired. Request a new one." };

  await db.user.update({
    where: { id: userId },
    // Getting the email proves ownership of the address, too.
    data: { passwordHash: await hashPassword(parsed.data.password), emailVerifiedAt: new Date() },
  });
  await destroyAllSessions(userId);
  await createSession(userId);
  refresh();
  redirect("/me?reset=1");
}
