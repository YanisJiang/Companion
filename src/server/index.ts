import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  clearSessionCookie,
  createSessionToken,
  passwordMatches,
  requireAuth,
  setSessionCookie,
  verifySessionToken,
} from "./auth.js";
import "./bootstrap.js";
import { handleUserMessage } from "./chat.js";
import { config } from "./config.js";
import {
  clearMemories,
  clearMessages,
  getSetting,
  listMemories,
  listMessages,
  setSetting,
} from "./db.js";
import {
  ensureDaySchedule,
  isClockPingEnabled,
  setClockPingEnabled,
} from "./clock.js";
import {
  getVapidPublicKey,
  isPushConfigured,
  isPushNotifyEnabled,
  savePushSubscription,
  setPushNotifyEnabled,
  type PushSubscriptionJSON,
} from "./push.js";
import {
  getIdleWindowMinutes,
  getInitiativeDailyCap,
  getInitiativeUsedToday,
  resetInitiativeUsedToday,
  setIdleWindowMinutes,
  setInitiativeDailyCap,
} from "./followup.js";
import { startProactiveLoop } from "./proactive.js";
import { ensureContinuityThreads } from "./continuity.js";
import { ensureTodayState } from "./today.js";
import {
  isReplyGenerating,
  noteTyping,
  resetReplyScheduler,
} from "./reply-scheduler.js";

const app = new Hono();

app.get("/api/health", (c) => c.json({ ok: true }));

app.get("/api/me", async (c) => {
  const token = getCookie(c, config.cookieName);
  const ok = verifySessionToken(token);
  if (!ok) return c.json({ authenticated: false });
  // 后台确保今日/日程/未完线有数据，但不返回给前端
  void ensureTodayState();
  void ensureDaySchedule();
  void ensureContinuityThreads();
  return c.json({
    authenticated: true,
    companionName: getSetting("companion_name") || config.companionName,
    userNickname: getSetting("user_nickname") || config.userNickname,
    proactiveEnabled: getSetting("proactive_enabled") === "1",
    clockPingEnabled: isClockPingEnabled(),
    pushNotifyEnabled: isPushNotifyEnabled(),
    pushConfigured: isPushConfigured(),
    initiativeDailyCap: getInitiativeDailyCap(),
    initiativeUsedToday: getInitiativeUsedToday(),
    idleMinMinutes: getIdleWindowMinutes().min,
    idleMaxMinutes: getIdleWindowMinutes().max,
  });
});

app.post("/api/login", async (c) => {
  const body = (await c.req.json().catch(() => null)) as {
    password?: string;
  } | null;
  if (!body?.password || !passwordMatches(body.password)) {
    return c.json({ error: "口令错误" }, 401);
  }
  const token = createSessionToken();
  setSessionCookie(c, token);
  return c.json({ ok: true });
});

app.post("/api/logout", (c) => {
  clearSessionCookie(c);
  return c.json({ ok: true });
});

const api = new Hono();
api.use("*", requireAuth);

api.get("/messages", (c) => {
  return c.json({ messages: listMessages(200) });
});

api.post("/chat", async (c) => {
  const body = (await c.req.json().catch(() => null)) as {
    content?: string;
  } | null;
  if (!body?.content?.trim()) {
    return c.json({ error: "消息不能为空" }, 400);
  }
  const result = await handleUserMessage(body.content);
  return c.json(result);
});

api.post("/typing", async (c) => {
  const body = (await c.req.json().catch(() => null)) as {
    typing?: boolean;
  } | null;
  noteTyping(Boolean(body?.typing));
  return c.json({ ok: true });
});

api.get("/reply-status", (c) => {
  return c.json({ generating: isReplyGenerating() });
});

api.get("/memories", (c) => {
  return c.json({ memories: listMemories() });
});

api.post("/memories/clear", (c) => {
  clearMemories();
  return c.json({ ok: true });
});

api.post("/messages/clear", (c) => {
  clearMessages();
  resetReplyScheduler();
  return c.json({ ok: true });
});

api.get("/settings", (c) => {
  return c.json({
    companionName: getSetting("companion_name") || config.companionName,
    userNickname: getSetting("user_nickname") || config.userNickname,
    proactiveEnabled: getSetting("proactive_enabled") === "1",
    clockPingEnabled: isClockPingEnabled(),
    pushNotifyEnabled: isPushNotifyEnabled(),
    pushConfigured: isPushConfigured(),
    initiativeDailyCap: getInitiativeDailyCap(),
    initiativeUsedToday: getInitiativeUsedToday(),
    idleMinMinutes: getIdleWindowMinutes().min,
    idleMaxMinutes: getIdleWindowMinutes().max,
  });
});

api.get("/push/vapid-public", (c) => {
  if (!isPushConfigured()) {
    return c.json({ error: "未配置 VAPID", configured: false }, 503);
  }
  return c.json({ publicKey: getVapidPublicKey(), configured: true });
});

api.post("/push/subscribe", async (c) => {
  const body = (await c.req.json().catch(() => null)) as {
    subscription?: PushSubscriptionJSON | null;
    enabled?: boolean;
  } | null;
  if (!body) return c.json({ error: "无效请求" }, 400);
  if (typeof body.enabled === "boolean") {
    setPushNotifyEnabled(body.enabled);
  }
  if (body.subscription === null) {
    savePushSubscription(null);
  } else if (body.subscription && typeof body.subscription.endpoint === "string") {
    savePushSubscription(body.subscription);
    setPushNotifyEnabled(true);
  }
  return c.json({
    ok: true,
    pushNotifyEnabled: isPushNotifyEnabled(),
    pushConfigured: isPushConfigured(),
  });
});

api.post("/settings", async (c) => {
  const body = (await c.req.json().catch(() => null)) as {
    companionName?: string;
    userNickname?: string;
    proactiveEnabled?: boolean;
    clockPingEnabled?: boolean;
    pushNotifyEnabled?: boolean;
    initiativeDailyCap?: number;
    idleMinMinutes?: number;
    idleMaxMinutes?: number;
    resetInitiativeUsedToday?: boolean;
  } | null;
  if (!body) return c.json({ error: "无效请求" }, 400);
  if (typeof body.companionName === "string" && body.companionName.trim()) {
    setSetting("companion_name", body.companionName.trim());
  }
  if (typeof body.userNickname === "string" && body.userNickname.trim()) {
    setSetting("user_nickname", body.userNickname.trim());
  }
  if (typeof body.proactiveEnabled === "boolean") {
    setSetting("proactive_enabled", body.proactiveEnabled ? "1" : "0");
  }
  if (typeof body.clockPingEnabled === "boolean") {
    setClockPingEnabled(body.clockPingEnabled);
  }
  if (typeof body.pushNotifyEnabled === "boolean") {
    setPushNotifyEnabled(body.pushNotifyEnabled);
  }
  if (typeof body.initiativeDailyCap === "number") {
    setInitiativeDailyCap(body.initiativeDailyCap);
  }
  if (
    typeof body.idleMinMinutes === "number" ||
    typeof body.idleMaxMinutes === "number"
  ) {
    const cur = getIdleWindowMinutes();
    setIdleWindowMinutes(
      typeof body.idleMinMinutes === "number"
        ? body.idleMinMinutes
        : cur.min,
      typeof body.idleMaxMinutes === "number"
        ? body.idleMaxMinutes
        : cur.max,
    );
  }
  if (body.resetInitiativeUsedToday === true) {
    resetInitiativeUsedToday();
  }
  const idle = getIdleWindowMinutes();
  return c.json({
    ok: true,
    clockPingEnabled: isClockPingEnabled(),
    pushNotifyEnabled: isPushNotifyEnabled(),
    pushConfigured: isPushConfigured(),
    initiativeDailyCap: getInitiativeDailyCap(),
    initiativeUsedToday: getInitiativeUsedToday(),
    idleMinMinutes: idle.min,
    idleMaxMinutes: idle.max,
  });
});

app.route("/api", api);

const webDist = resolve(process.cwd(), "dist/web");
if (existsSync(webDist)) {
  app.use("/*", serveStatic({ root: "./dist/web" }));
  app.get("*", serveStatic({ path: "./dist/web/index.html" }));
} else {
  app.get("/", (c) =>
    c.text(
      "API 已启动。开发请另开 Vite（npm run dev），或先 npm run build 再访问静态页。",
    ),
  );
}

startProactiveLoop();

console.log(`[companion] http://127.0.0.1:${config.port}`);
serve({ fetch: app.fetch, port: config.port });
