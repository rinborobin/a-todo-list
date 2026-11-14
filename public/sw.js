// Shows reminders sent by the server and opens the app when one is tapped.
// It does not cache anything, so it never changes how the app loads.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const text = (value) => (typeof value === "string" ? value : "");

  event.waitUntil(
    self.registration.showNotification(text(data.title) || "Planner", {
      body: text(data.body),
      icon: "/icon",
      badge: "/icon",
      tag: text(data.tag) || undefined,
      data: { url: text(data.url) },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  // Only ever open a page of this app.
  const path = event.notification.data && event.notification.data.url;
  const safe = typeof path === "string" && path.startsWith("/") && !path.startsWith("//") ? path : "/today";
  const url = new URL(safe, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) await client.navigate(url).catch(() => undefined);
          return;
        }
      }
      await self.clients.openWindow(url);
    })()
  );
});
