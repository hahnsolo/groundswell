"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

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

/**
 * Cloudflare Turnstile. Adds a hidden `cf-turnstile-response` field to the
 * enclosing form; the server checks it (src/lib/spam.ts). Mostly invisible —
 * it only shows a checkbox when a visitor looks suspicious. Renders nothing
 * when no site key is configured.
 *
 * Pass the form's action state as `resetKey`: tokens are single-use, so the
 * widget fetches a fresh one after every submit.
 */
export function Turnstile({ resetKey }: { resetKey?: unknown }) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!SITE_KEY || !ready || !container.current || !window.turnstile) return;
    widgetId.current = window.turnstile.render(container.current, {
      sitekey: SITE_KEY,
      appearance: "interaction-only",
      theme: "auto",
    });
    return () => {
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [ready]);

  useEffect(() => {
    if (resetKey && widgetId.current) window.turnstile?.reset(widgetId.current);
  }, [resetKey]);

  if (!SITE_KEY) return null;
  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        onReady={() => setReady(true)}
      />
      <div ref={container} />
    </>
  );
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
