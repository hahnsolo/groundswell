import "server-only";
import { createPrivateKey, sign } from "node:crypto";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { captcha } from "better-auth/plugins";
import { db } from "./db";
import { sendEmail } from "./mail";

// ---------- Social providers (each turns on only when its env vars are set) ----------

const google =
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET }
    : undefined;

const apple =
  process.env.APPLE_CLIENT_ID && process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID && process.env.APPLE_PRIVATE_KEY
    ? {
        clientId: process.env.APPLE_CLIENT_ID,
        clientSecret: appleClientSecret({
          clientId: process.env.APPLE_CLIENT_ID,
          teamId: process.env.APPLE_TEAM_ID,
          keyId: process.env.APPLE_KEY_ID,
          // Env vars can't hold newlines everywhere, so accept "\n"-escaped keys.
          privateKey: process.env.APPLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        }),
        appBundleIdentifier: process.env.APPLE_APP_BUNDLE_ID || undefined,
      }
    : undefined;

export const enabledSocialProviders = [google && "google", apple && "apple"].filter(Boolean) as ("google" | "apple")[];

/**
 * Apple doesn't issue a client secret; you sign one yourself (an ES256 JWT,
 * valid for at most 6 months) with the .p8 key from your Apple developer
 * account. We sign a fresh one each time the server starts.
 */
function appleClientSecret(o: { clientId: string; teamId: string; keyId: string; privateKey: string }) {
  const now = Math.floor(Date.now() / 1000);
  const b64 = (v: object) => Buffer.from(JSON.stringify(v)).toString("base64url");
  const unsigned = `${b64({ alg: "ES256", kid: o.keyId })}.${b64({
    iss: o.teamId,
    iat: now,
    exp: now + 150 * 24 * 60 * 60,
    aud: "https://appleid.apple.com",
    sub: o.clientId,
  })}`;
  const signature = sign("sha256", Buffer.from(unsigned), {
    key: createPrivateKey(o.privateKey),
    dsaEncoding: "ieee-p1363",
  }).toString("base64url");
  return `${unsigned}.${signature}`;
}

// ---------- Auth ----------

// Without a real secret, session cookies could be forged. Fail loudly in
// production rather than run with a default. (Skipped during `next build`.)
if (
  process.env.NODE_ENV === "production" &&
  process.env.NEXT_PHASE !== "phase-production-build" &&
  (process.env.BETTER_AUTH_SECRET ?? "").length < 32
) {
  throw new Error("BETTER_AUTH_SECRET must be set to a random string of at least 32 characters in production.");
}

export const auth = betterAuth({
  appName: "Groundswell",
  baseURL: process.env.APP_URL ?? "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, { provider: "sqlite" }),
  // Apple posts its sign-in response back from its own origin.
  trustedOrigins: apple ? ["https://appleid.apple.com"] : [],

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    autoSignIn: true,
    // People can sign in before confirming; posting is what requires it.
    requireEmailVerification: false,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Reset your Groundswell password",
        text: `Hi ${user.name},\n\nSomeone (hopefully you) asked to reset your password. Choose a new one here:\n${url}\n\nThis link expires in 1 hour. If you didn't ask for this, ignore this email — your password won't change.`,
      });
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: 48 * 60 * 60,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Confirm your email for Groundswell",
        text: `Hi ${user.name},\n\nConfirm your email so you can post issues, comments and meetups:\n${url}\n\nThis link expires in 48 hours. If you didn't sign up, you can ignore this email.`,
      });
    },
  },

  socialProviders: { ...(google && { google }), ...(apple && { apple }) },

  account: {
    // Google and Apple verify emails, so signing in with one links to an
    // existing account with the same address instead of failing.
    accountLinking: { enabled: true, trustedProviders: ["google", "apple"] },
  },

  user: {
    additionalFields: {
      // input: false — never settable through sign-up or the public API.
      isAdmin: { type: "boolean", defaultValue: false, input: false },
      homeCountry: { type: "string", required: false, input: false },
      homePostal: { type: "string", required: false, input: false },
    },
  },

  databaseHooks: {
    user: {
      create: {
        // Guard names however the account is created (form, API, or Google/Apple profile).
        before: async (user) => {
          const name = (user.name ?? "").trim().slice(0, 60) || user.email.split("@")[0];
          return { data: { ...user, name } };
        },
      },
    },
  },

  session: { expiresIn: 30 * 24 * 60 * 60 },

  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 15 * 60, max: 20 },
      "/sign-up/email": { window: 60 * 60, max: 10 },
      "/request-password-reset": { window: 60 * 60, max: 5 },
      "/send-verification-email": { window: 60 * 60, max: 5 },
    },
  },

  plugins: [
    // Bots calling the public auth endpoints directly must pass Turnstile too.
    // (Our Server Actions check it themselves; see src/lib/spam.ts.)
    ...(process.env.TURNSTILE_SECRET_KEY
      ? [
          captcha({
            provider: "cloudflare-turnstile",
            secretKey: process.env.TURNSTILE_SECRET_KEY,
            endpoints: ["/sign-up/email", "/sign-in/email", "/request-password-reset", "/send-verification-email"],
          }),
        ]
      : []),
    // Must be last: lets Server Actions set auth cookies.
    nextCookies(),
  ],
});
