/**
 * Browser side of reminders: what this device can do, and turning its
 * notification subscription on and off. Call only from the browser.
 */

export type DeviceState =
  /** The browser has no notifications at all. */
  | "unsupported"
  /** iPhone or iPad in a Safari tab: notifications need the Home Screen app. */
  | "needs-install"
  /** The person said no, or switched notifications off in the phone settings. */
  | "blocked"
  | "off"
  | "on";

export interface DeviceSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

const WORKER_URL = "/sw.js";

function isIos(): boolean {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac; the touch screen gives it away.
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

function isInstalled(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function toSubscription(sub: PushSubscription): DeviceSubscription | null {
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return null;
  return { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } };
}

function toBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const padded = base64Url + "=".repeat((4 - (base64Url.length % 4)) % 4);
  const raw = window.atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function existingSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration("/");
  return registration ? registration.pushManager.getSubscription() : null;
}

export async function detectDevice(): Promise<{ state: DeviceState; subscription: DeviceSubscription | null }> {
  const none = (state: DeviceState) => ({ state, subscription: null });
  if (isIos() && !isInstalled()) return none("needs-install");
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return none("unsupported");
  }
  if (Notification.permission === "denied") return none("blocked");
  try {
    const sub = Notification.permission === "granted" ? await existingSubscription() : null;
    const subscription = sub ? toSubscription(sub) : null;
    return subscription ? { state: "on", subscription } : none("off");
  } catch {
    return none("off");
  }
}

/**
 * Asks for permission and subscribes this device. Must be called from a tap:
 * browsers refuse a permission prompt that the person did not ask for.
 */
export async function subscribeDevice(
  publicKey: string
): Promise<{ status: "ok"; subscription: DeviceSubscription } | { status: "blocked" | "dismissed" | "failed" }> {
  const permission = await Notification.requestPermission();
  if (permission === "denied") return { status: "blocked" };
  if (permission !== "granted") return { status: "dismissed" };

  try {
    const registration = await navigator.serviceWorker.register(WORKER_URL, { scope: "/", updateViaCache: "none" });
    await navigator.serviceWorker.ready;
    const options = { userVisibleOnly: true, applicationServerKey: toBytes(publicKey) };

    let sub = await registration.pushManager.getSubscription();
    if (!sub) {
      sub = await registration.pushManager.subscribe(options);
    }
    const subscription = toSubscription(sub);
    return subscription ? { status: "ok", subscription } : { status: "failed" };
  } catch {
    return { status: "failed" };
  }
}

/** Unsubscribes this device and returns the address the server should forget. */
export async function unsubscribeDevice(): Promise<string | null> {
  try {
    if (!("serviceWorker" in navigator)) return null;
    const sub = await existingSubscription();
    if (!sub) return null;
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    return endpoint;
  } catch {
    return null;
  }
}
