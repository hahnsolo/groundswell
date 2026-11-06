"use client";

import { useEffect, useState } from "react";
import { buttonStyles } from "./styles";

// Turning on push notifications for this device (#72), from /me and from a
// gentle prompt after joining a cause. The browser asks permission first.

type State = "loading" | "unsupported" | "ios-howto" | "denied" | "off" | "on";

function base64UrlToBytes(key: string) {
  const b64 = key.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (key.length % 4)) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

const worker = async () => (await navigator.serviceWorker.getRegistration("/")) ?? navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });

async function currentState(): Promise<State> {
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (!supported) {
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    return iOS ? "ios-howto" : "unsupported";
  }
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return "off";
  // The browser can still be subscribed after signing out; the site decides whether it's really on.
  const res = await fetch("/api/push").catch(() => null);
  const mine = res?.ok ? ((await res.json()) as { endpoints: string[] }).endpoints : [];
  return mine.includes(sub.endpoint) ? "on" : "off";
}

async function turnOn(publicKey: string) {
  if ((await Notification.requestPermission()) !== "granted") return false;
  await worker();
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(publicKey) }));
  const res = await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
  return res.ok;
}

async function turnOff() {
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await fetch("/api/push", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
  await sub.unsubscribe();
}

function usePushState() {
  const [state, setState] = useState<State>("loading");
  useEffect(() => {
    let live = true;
    currentState()
      .catch((): State => "unsupported")
      .then((s) => {
        if (live) setState(s);
      });
    return () => {
      live = false;
    };
  }, []);
  return [state, setState] as const;
}

const IOS_HOWTO = "On an iPhone, add Groundswell to your home screen first: tap Share, then Add to Home Screen. Open it from there and come back to this page.";

/** The setting on /me. */
export function PushToggle({ publicKey }: { publicKey: string }) {
  const [state, setState] = usePushState();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setNote(null);
    try {
      await work();
    } catch {
      setNote("That didn't work on this device. Please try again.");
    }
    setBusy(false);
  };
  return (
    <div className="space-y-2 text-sm" data-testid="push-toggle">
      {state === "on" && <p>Notifications are <strong>on</strong> on this device. Signing out turns them off here.</p>}
      {state === "off" && <p>Get the kinds you&apos;ve chosen below on your phone or computer, even when Groundswell isn&apos;t open. Tapping one opens the right page.</p>}
      {state === "denied" && <p className="text-muted">This browser has notifications blocked for Groundswell. You can allow them in its site settings.</p>}
      {state === "unsupported" && <p className="text-muted">This browser can&apos;t show push notifications. You&apos;ll still see them under your name icon.</p>}
      {state === "ios-howto" && <p className="text-muted">{IOS_HOWTO}</p>}
      {state === "off" && (
        <button
          type="button"
          disabled={busy}
          className={buttonStyles.secondary}
          onClick={() =>
            run(async () => {
              const ok = await turnOn(publicKey);
              setState(await currentState());
              if (!ok) setNote("Push wasn't turned on. You'll still see notifications under your name icon.");
            })
          }
        >
          {busy ? "Turning on…" : "Turn on notifications on this device"}
        </button>
      )}
      {state === "on" && (
        <button
          type="button"
          disabled={busy}
          className={buttonStyles.secondary}
          onClick={() =>
            run(async () => {
              await turnOff();
              setState("off");
            })
          }
        >
          {busy ? "Turning off…" : "Turn off on this device"}
        </button>
      )}
      {note && (
        <p role="status" className="text-muted">
          {note}
        </p>
      )}
    </div>
  );
}

const DISMISSED = "gs_push_prompt_dismissed";

/** After joining a cause, never on a first visit: a quiet offer, once, until dismissed. */
export function PushPrompt({ publicKey }: { publicKey: string }) {
  const [state, setState] = usePushState();
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- browser storage is only readable here
      if (localStorage.getItem(DISMISSED)) setHidden(true);
    } catch {
      // No storage: the offer can show again.
    }
  }, []);
  if (hidden || state !== "off" || (typeof Notification !== "undefined" && Notification.permission !== "default")) return null;
  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED, "1");
    } catch {
      // Ignore.
    }
    setHidden(true);
  };
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-md border border-border bg-surface p-3 text-sm" data-testid="push-prompt">
      <span className="min-w-0 flex-1">Want a notification on this device for events and news from your causes?</span>
      <button
        type="button"
        className={`${buttonStyles.secondary} !px-3 !py-1.5`}
        onClick={async () => {
          await turnOn(publicKey).catch(() => false);
          setState(await currentState().catch((): State => "off"));
          dismiss();
        }}
      >
        Turn on
      </button>
      <button type="button" className="text-xs text-muted underline hover:text-foreground" onClick={dismiss}>
        Not now
      </button>
    </div>
  );
}
