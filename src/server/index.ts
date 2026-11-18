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
import { DEFAULT_DOSSIER, DEFAULT_PERSONA } from "./persona.js";
import { startProactiveLoop } from "./proactive.js";
import {
  isReplyGenerating,
  noteTyping,
  resetReplyScheduler,
} from "./reply-scheduler.js";

function currentPersona(): string {
  return getSetting("persona") || config.persona || DEFAULT_PERSONA;
}

function currentDossier(): string {
  return getSetting("character_dossier") || DEFAULT_DOSSIER;
}

const app = new Hono();

app.get("/api/health", (c) => c.json({ ok: true }));

app.get("/api/me", (c) => {
  const token = getCookie(c, config.cookieName);
  const ok = verifySessionToken(token);
  if (!ok) return c.json({ authenticated: false });
  return c.json({
    authenticated: true,
    companionName: getSetting("companion_name") || config.companionName,
    userNickname: getSetting("user_nickname") || config.userNickname,
    persona: currentPersona(),
    characterDossier: currentDossier(),
    proactiveEnabled: getSetting("proactive_enabled") === "1",
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
    persona: currentPersona(),
    characterDossier: currentDossier(),
    proactiveEnabled: getSetting("proactive_enabled") === "1",
  });
});

api.post("/settings", async (c) => {
  const body = (await c.req.json().catch(() => null)) as {
    companionName?: string;
    userNickname?: string;
    persona?: string;
    characterDossier?: string;
    proactiveEnabled?: boolean;
  } | null;
  if (!body) return c.json({ error: "无效请求" }, 400);
  if (typeof body.companionName === "string" && body.companionName.trim()) {
    setSetting("companion_name", body.companionName.trim());
  }
  if (typeof body.userNickname === "string" && body.userNickname.trim()) {
    setSetting("user_nickname", body.userNickname.trim());
  }
  if (typeof body.persona === "string") {
    const text = body.persona.trim();
    if (text) setSetting("persona", text);
  }
  if (typeof body.characterDossier === "string") {
    const text = body.characterDossier.trim();
    if (text) setSetting("character_dossier", text);
  }
  if (typeof body.proactiveEnabled === "boolean") {
    setSetting("proactive_enabled", body.proactiveEnabled ? "1" : "0");
  }
  return c.json({ ok: true });
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
