/// <reference lib="webworker" />
/* eslint-disable no-restricted-globals */

const SW_VERSION = "1.0.0";
const CACHE_NAME = `pkl-v${SW_VERSION}`;
const OFFLINE_URL = "/offline.html";

// Assets to pre-cache on install
const PRECACHE_URLS = [
  "/",
  "/offline.html",
];

// ── Install ──
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// ── Activate ──
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch — Network-first with cache fallback ──
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Skip non-GET and API/socket requests 
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/socket.io")) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful responses for static assets
        if (response.ok && (url.pathname.match(/\.(js|css|png|jpg|svg|woff2?)$/) || url.pathname === "/")) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => {
          if (cached) return cached;
          // For navigation requests, show offline page
          if (request.mode === "navigate") {
            return caches.match(OFFLINE_URL).then((offlinePage) => offlinePage || new Response("Offline", { status: 503 }));
          }
          return new Response("Offline", { status: 503 });
        })
      )
  );
});

// ── Push Notifications ──
self.addEventListener("push", (event) => {
  let data = { title: "PKL Court Connect", body: "You have a new notification", icon: "/icons/icon-192x192.png" };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch {
      data.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || "/icons/icon-192x192.png",
      badge: "/icons/icon-72x72.png",
      vibrate: [100, 50, 100],
      data: data,
      actions: [
        { action: "open", title: "Open" },
        { action: "dismiss", title: "Dismiss" },
      ],
    })
  );
});

// ── Notification Click ──
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Focus existing window if available
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      // Open new window
      return self.clients.openWindow("/");
    })
  );
});

// ── Firebase Cloud Messaging background handler ──
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
