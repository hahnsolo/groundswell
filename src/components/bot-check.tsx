"use client";

import Script from "next/script";
import { useEffect, useRef, useState, type ReactNode } from "react";

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

type Check = "checking" | "passed" | "failed";

/**
 * Cloudflare Turnstile. Adds a hidden `cf-turnstile-response` field to the
 * enclosing form; the server checks it (src/lib/spam.ts). Mostly invisible —
 * it only shows a checkbox when a visitor looks suspicious.
 *
 * Returns the widget to place in the form, and whether the check has passed.
 * Keep the submit button disabled until it has: the check takes a moment, and
 * on phones password autofill makes it easy to submit before it's done, which
 * the server then refuses.
 *
 * Pass the form's action state as `resetKey`: tokens are single-use, so the
 * widget fetches a fresh one after every submit.
 */
export function useBotCheck(resetKey?: unknown): { widget: ReactNode; passed: boolean } {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const [check, setCheck] = useState<Check>("checking");

  useEffect(() => {
    if (!SITE_KEY || !ready || !container.current || !window.turnstile) return;
    widgetId.current = window.turnstile.render(container.current, {
      sitekey: SITE_KEY,
      appearance: "interaction-only",
      theme: "auto",
      callback: () => setCheck("passed"),
      // Tokens last 5 minutes; Turnstile fetches a new one by itself.
      "expired-callback": () => setCheck("checking"),
      "error-callback": () => setCheck("failed"),
    });
    return () => {
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [ready]);

  useEffect(() => {
    if (!resetKey || !widgetId.current) return;
    window.turnstile?.reset(widgetId.current);
    // The used token is gone until the widget fetches the next one.
    setCheck("checking");
  }, [resetKey]);

  if (!SITE_KEY) return { widget: null, passed: true };
  return {
    passed: check === "passed",
    widget: (
      <>
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          onReady={() => setReady(true)}
          onError={() => setCheck("failed")}
        />
        <div ref={container} />
        {check === "failed" && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-300">
            The &quot;are you human?&quot; check couldn&apos;t finish. Check your connection, turn off any content blocker for
            this site, or try another browser, then reload the page.
          </p>
        )}
      </>
    ),
  };
}

/** A field people never see. Bots that fill in every input give themselves away. */
export function Honeypot() {
  return (
    <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
      <label>
        Website
        <input name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
      </label>
    </div>
  );
}
