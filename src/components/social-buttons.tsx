"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { buttonStyles } from "./styles";

type Provider = "google" | "apple";

const LABELS: Record<Provider, string> = { google: "Continue with Google", apple: "Continue with Apple" };

export function SocialButtons({ providers, next }: { providers: Provider[]; next?: string }) {
  const [pending, setPending] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (providers.length === 0) return null;

  async function start(provider: Provider) {
    setPending(provider);
    setError(null);
    // Redirects the browser to Google/Apple; we only come back here on failure.
    const { error } = await authClient.signIn.social({
      provider,
      callbackURL: next ?? "/",
      newUserCallbackURL: "/me?welcome=1",
      errorCallbackURL: "/signin",
    });
    if (error) {
      setError(error.message ?? "Something went wrong. Please try again.");
      setPending(null);
    }
  }

  return (
    <div className="space-y-2">
      {providers.map((p) => (
        <button
          key={p}
          type="button"
          disabled={pending !== null}
          onClick={() => start(p)}
          className={`${buttonStyles.secondary} w-full ${p === "apple" ? "!border-black !bg-black !text-white hover:!bg-neutral-800 dark:!border-white dark:!bg-white dark:!text-black" : ""}`}
        >
          {p === "google" ? <GoogleLogo /> : <AppleLogo />}
          {pending === p ? "Redirecting…" : LABELS[p]}
        </button>
      ))}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex items-center gap-3 py-2 text-xs text-muted">
        <span className="h-px flex-1 bg-border" /> or use email <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}

function GoogleLogo() {
  return (
    <svg aria-hidden viewBox="0 0 48 48" className="h-4 w-4">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.2-.1-2.3-.4-3.5z" />
    </svg>
  );
}

function AppleLogo() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M16.37 12.6c-.02-2.2 1.8-3.26 1.88-3.31-1.02-1.5-2.62-1.7-3.19-1.72-1.36-.14-2.65.8-3.34.8-.69 0-1.75-.78-2.88-.76-1.48.02-2.85.86-3.61 2.19-1.54 2.67-.39 6.62 1.11 8.79.73 1.06 1.6 2.25 2.75 2.21 1.1-.04 1.52-.71 2.85-.71 1.33 0 1.71.71 2.88.69 1.19-.02 1.94-1.08 2.67-2.14.84-1.23 1.19-2.42 1.21-2.48-.03-.01-2.32-.89-2.33-3.56zM14.18 6.13c.61-.74 1.02-1.76.91-2.78-.88.04-1.94.59-2.57 1.32-.56.65-1.06 1.69-.93 2.69.98.08 1.98-.5 2.59-1.23z" />
    </svg>
  );
}
