"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ChatPass } from "@/lib/live-chat";

// Keeps an open chat up to date. With a pass, it listens to the live chat
// server and refreshes the messages the moment something changes. Without one,
// or while the connection is down, it checks every few seconds instead.
// Either way the messages themselves always come from the site.

const CHECK_EVERY_MS = 10_000;
const PING_EVERY_MS = 30_000;
const PASS_REFUSED = 4001; // matches realtime/src/index.ts

type Status = "connecting" | "live" | "checking";

export function LiveChat({ pass }: { pass: ChatPass | null }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(pass ? "connecting" : "checking");
  const url = pass?.url;
  const token = pass?.token;

  useEffect(() => {
    let ws: WebSocket | null = null;
    let stopped = false;
    let attempts = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    let checkTimer: ReturnType<typeof setInterval> | undefined;

    // A burst of changes (say, a moderator clearing several messages) becomes one refresh.
    const refreshSoon = () => {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => router.refresh(), 150);
    };
    const startChecking = () => {
      checkTimer ??= setInterval(() => {
        if (document.visibilityState === "visible") router.refresh();
      }, CHECK_EVERY_MS);
    };
    const stopChecking = () => {
      clearInterval(checkTimer);
      checkTimer = undefined;
    };

    function connect() {
      if (!url || !token) return startChecking();
      ws = new WebSocket(`${url}/connect?token=${encodeURIComponent(token)}`);
      ws.onopen = () => {
        // After a dropped connection, catch up on anything missed meanwhile.
        if (attempts > 0) refreshSoon();
        attempts = 0;
        setStatus("live");
        stopChecking();
      };
      ws.onmessage = (e) => {
        if (e.data === "changed") refreshSoon();
      };
      ws.onclose = (e) => {
        if (stopped) return;
        setStatus("checking");
        startChecking();
        // An expired pass: the next refresh brings a fresh one, which reconnects.
        if (e.code === PASS_REFUSED) return router.refresh();
        attempts++;
        reconnectTimer = setTimeout(connect, Math.min(30_000, 1000 * 2 ** attempts));
      };
    }

    connect();
    const ping = setInterval(() => {
      if (ws?.readyState === WebSocket.OPEN) ws.send("ping");
    }, PING_EVERY_MS);

    return () => {
      stopped = true;
      ws?.close();
      clearTimeout(reconnectTimer);
      clearTimeout(refreshTimer);
      clearInterval(ping);
      stopChecking();
    };
  }, [url, token, router]);

  if (status === "connecting") return null;
  return (
    <p className="mb-4 flex items-center gap-2 text-xs text-muted" role="status">
      {status === "live" ? (
        <>
          <span className="h-2 w-2 rounded-full bg-sage" aria-hidden="true" />
          Live: new messages appear as they&apos;re sent
        </>
      ) : (
        "New messages appear within a few seconds"
      )}
    </p>
  );
}
