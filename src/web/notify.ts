/** 页在后台时的本地通知兜底（不依赖 Web Push）。 */

let lastNotifiedId = 0;

export async function ensureNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export function maybeLocalNotifyProactive(msg: {
  id: number;
  role: string;
  content: string;
  is_proactive: number;
}): void {
  if (typeof document === "undefined" || typeof window === "undefined") return;
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  if (!document.hidden) return;
  if (msg.role !== "assistant" || !msg.is_proactive) return;
  if (msg.id <= lastNotifiedId) return;
  lastNotifiedId = msg.id;
  try {
    new Notification("她找你了", {
      body: msg.content.slice(0, 120),
      icon: "/icon-192.png",
      tag: `proactive-${msg.id}`,
    });
  } catch {
    /* ignore */
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function registerPushServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch {
    return null;
  }
}

export async function subscribeWebPush(
  vapidPublicKey: string,
): Promise<PushSubscriptionJSON | null> {
  const reg = await registerPushServiceWorker();
  if (!reg) return null;
  const ready = await navigator.serviceWorker.ready;
  let sub = await ready.pushManager.getSubscription();
  if (!sub) {
    sub = await ready.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        vapidPublicKey,
      ) as BufferSource,
    });
  }
  return sub.toJSON() as PushSubscriptionJSON;
}

export async function unsubscribeWebPush(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) await sub.unsubscribe();
}
