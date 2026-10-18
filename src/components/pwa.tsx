"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

/** Registers the service worker. Production only, so it never caches dev builds. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch((err) => {
      console.error("Service worker registration failed", err);
    });
  }, []);
  return null;
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "gs-install-dismissed";

// What kind of install help this browser needs. Read on the client only; the
// server snapshot is "unknown" so server and client markup match.
function platformSnapshot(): string {
  try {
    if (localStorage.getItem(DISMISS_KEY)) return "dismissed";
  } catch {
    // Storage blocked — just keep going.
  }
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return "installed";
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  // Only Safari can add to the home screen on iOS.
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  if (isIOS) return isSafari ? "ios-safari" : "ios-other";
  return "other";
}

const subscribe = () => () => {};

/**
 * A small, dismissible prompt to install the app:
 * - Chrome/Edge/Android: a real "Install" button (beforeinstallprompt).
 * - iPhone Safari: how to use Share → Add to Home Screen.
 */
export function InstallPrompt() {
  const platform = useSyncExternalStore(subscribe, platformSnapshot, () => "unknown");
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setHidden(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Ignore — it just shows again next visit.
    }
  };

  if (hidden || ["unknown", "dismissed", "installed", "ios-other"].includes(platform)) return null;
  const iosHint = platform === "ios-safari";
  if (!iosHint && !deferred) return null;

  return (
    <div
      role="dialog"
      aria-label="Install Groundswell"
      className="fixed inset-x-3 bottom-3 z-20 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-border bg-surface p-3 shadow-lg sm:inset-x-auto sm:right-4"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/icon-192.png" alt="" width={40} height={40} className="rounded-xl" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium">Get the Groundswell app</p>
        <p className="text-muted">
          {iosHint ? (
            <>
              Tap <ShareIcon /> <strong>Share</strong>, then <strong>Add to Home Screen</strong>.
            </>
          ) : (
            "Install it for quick access and meetup reminders."
          )}
        </p>
      </div>
      {!iosHint && deferred && (
        <button
          className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-strong"
          onClick={async () => {
            await deferred.prompt();
            await deferred.userChoice;
            setDeferred(null);
          }}
        >
          Install
        </button>
      )}
      <button onClick={dismiss} aria-label="Dismiss" className="rounded-lg px-2 py-1 text-muted hover:bg-brand-soft">
        ✕
      </button>
    </div>
  );
}

function ShareIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="inline h-4 w-4 -translate-y-px" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
