// Groundswell service worker.
// Deliberately small: it makes the app installable, caches static assets, and
// shows an offline page instead of the browser's error. It never caches page
// HTML or data, so nobody sees stale (or someone else's) signed-in content.

const CACHE = "groundswell-v3";
const OFFLINE_URL = "/offline";
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Push notifications (#72): show what the site sent, and open the right page when tapped.
self.addEventListener("push", (event) => {
  let message = { title: "Groundswell", body: "", url: "/me" };
  try {
    message = { ...message, ...event.data.json() };
  } catch {
    // Not what we send: show the plain default.
  }
  event.waitUntil(self.registration.showNotification(message.title, { body: message.body, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", data: { url: message.url } }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // Only ever a page on this site.
  const target = new URL(event.notification.data?.url ?? "/me", self.location.origin);
  const url = target.origin === self.location.origin ? target.href : self.location.origin;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((open) => {
      const same = open.find((c) => c.url === url);
      if (same) return same.focus();
      return self.clients.openWindow(url);
    }),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Page loads: always go to the network; fall back to the offline page.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  // Build assets are content-hashed and never change, so cache-first is safe.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
});
