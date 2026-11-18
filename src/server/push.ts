import { createRequire } from "node:module";
import { config } from "./config.js";
import { getSetting, setSetting } from "./db.js";

const require = createRequire(import.meta.url);
const webpush = require("web-push") as {
  setVapidDetails: (subject: string, publicKey: string, privateKey: string) => void;
  sendNotification: (
    subscription: unknown,
    payload: string,
    options?: { TTL?: number },
  ) => Promise<unknown>;
};

const SUB_KEY = "push_subscription";
const ENABLED_KEY = "push_notify_enabled";

export type PushSubscriptionJSON = {
  endpoint: string;
  keys?: { p256dh?: string; auth?: string };
};

export function isPushConfigured(): boolean {
  return Boolean(config.vapidPublicKey && config.vapidPrivateKey);
}

export function getVapidPublicKey(): string {
  return config.vapidPublicKey;
}

export function isPushNotifyEnabled(): boolean {
  const raw = getSetting(ENABLED_KEY);
  if (raw === "") return false;
  return raw === "1";
}

export function setPushNotifyEnabled(on: boolean): void {
  setSetting(ENABLED_KEY, on ? "1" : "0");
  if (!on) setSetting(SUB_KEY, "");
}

export function savePushSubscription(sub: PushSubscriptionJSON | null): void {
  if (!sub?.endpoint) {
    setSetting(SUB_KEY, "");
    return;
  }
  setSetting(SUB_KEY, JSON.stringify(sub));
}

export function readPushSubscription(): PushSubscriptionJSON | null {
  const raw = getSetting(SUB_KEY);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as PushSubscriptionJSON;
    if (!data?.endpoint) return null;
    return data;
  } catch {
    return null;
  }
}

function ensureVapid(): boolean {
  if (!isPushConfigured()) return false;
  webpush.setVapidDetails(
    config.vapidSubject,
    config.vapidPublicKey,
    config.vapidPrivateKey,
  );
  return true;
}

/** 主动消息入库后调用：尽量推一条系统通知。 */
export async function notifyProactivePush(body: string): Promise<void> {
  if (!isPushNotifyEnabled()) return;
  if (!ensureVapid()) {
    console.log("[push] skip: VAPID 未配置");
    return;
  }
  const sub = readPushSubscription();
  if (!sub) {
    console.log("[push] skip: 无订阅");
    return;
  }
  const title = getSetting("companion_name") || config.companionName;
  const payload = JSON.stringify({
    title,
    body: body.slice(0, 120),
    url: "/",
  });
  try {
    await webpush.sendNotification(sub, payload, { TTL: 60 * 60 });
    console.log("[push] sent");
  } catch (err: unknown) {
    const status =
      err && typeof err === "object" && "statusCode" in err
        ? Number((err as { statusCode?: number }).statusCode)
        : 0;
    console.error("[push] send failed", status || err);
    if (status === 404 || status === 410) {
      setSetting(SUB_KEY, "");
    }
  }
}
