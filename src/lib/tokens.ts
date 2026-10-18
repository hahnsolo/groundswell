import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { db } from "./db";
import { appUrl, sendEmail } from "./mail";

export type TokenPurpose = "verify_email" | "reset_password";

const TTL_MS: Record<TokenPurpose, number> = {
  verify_email: 48 * 60 * 60 * 1000,
  reset_password: 60 * 60 * 1000,
};

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

/** Create a single-use token (invalidating older unused ones of the same purpose). */
async function issueToken(userId: string, purpose: TokenPurpose) {
  const token = randomBytes(32).toString("base64url");
  await db.$transaction([
    db.authToken.deleteMany({ where: { userId, purpose, usedAt: null } }),
    db.authToken.create({
      data: { id: hash(token), userId, purpose, expiresAt: new Date(Date.now() + TTL_MS[purpose]) },
    }),
  ]);
  return token;
}

/** Mark a token used and return its user id, or null if invalid/expired/used. */
export async function consumeToken(token: string, purpose: TokenPurpose) {
  const record = await db.authToken.findUnique({ where: { id: hash(token) } });
  if (!record || record.purpose !== purpose || record.usedAt || record.expiresAt < new Date()) return null;
  // Conditional update so two simultaneous submissions can't both succeed.
  const { count } = await db.authToken.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  return count === 1 ? record.userId : null;
}

/** Check a token without using it up (to decide what a page should show). */
export async function peekToken(token: string, purpose: TokenPurpose) {
  const record = await db.authToken.findUnique({ where: { id: hash(token) } });
  return !!record && record.purpose === purpose && !record.usedAt && record.expiresAt > new Date();
}

export async function sendVerificationEmail(user: { id: string; email: string; name: string }) {
  const token = await issueToken(user.id, "verify_email");
  const link = appUrl(`/verify?token=${token}`);
  await sendEmail({
    to: user.email,
    subject: "Confirm your email for Groundswell",
    text: `Hi ${user.name},\n\nConfirm your email so you can post issues, comments and meetups:\n${link}\n\nThis link expires in 48 hours. If you didn't sign up, you can ignore this email.`,
    html: `<p>Hi ${escapeHtml(user.name)},</p><p>Confirm your email so you can post issues, comments and meetups:</p><p><a href="${link}">Confirm my email</a></p><p>This link expires in 48 hours. If you didn't sign up, you can ignore this email.</p>`,
  });
}

export async function sendPasswordResetEmail(user: { id: string; email: string; name: string }) {
  const token = await issueToken(user.id, "reset_password");
  const link = appUrl(`/reset-password?token=${token}`);
  await sendEmail({
    to: user.email,
    subject: "Reset your Groundswell password",
    text: `Hi ${user.name},\n\nSomeone (hopefully you) asked to reset your password. Choose a new one here:\n${link}\n\nThis link expires in 1 hour. If you didn't ask for this, ignore this email — your password won't change.`,
    html: `<p>Hi ${escapeHtml(user.name)},</p><p>Someone (hopefully you) asked to reset your password.</p><p><a href="${link}">Choose a new password</a></p><p>This link expires in 1 hour. If you didn't ask for this, ignore this email — your password won't change.</p>`,
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
