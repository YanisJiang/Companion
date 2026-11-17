import { createHmac, timingSafeEqual } from "node:crypto";
import type { Context, Next } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { config } from "./config.js";

type SessionPayload = {
  v: 1;
  exp: number;
};

function sign(payloadB64: string): string {
  return createHmac("sha256", config.sessionSecret)
    .update(payloadB64)
    .digest("base64url");
}

export function createSessionToken(): string {
  const payload: SessionPayload = {
    v: 1,
    exp: Date.now() + config.sessionTtlMs,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  return `${payloadB64}.${sign(payloadB64)}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) return false;
  const expected = sign(payloadB64);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  } catch {
    return false;
  }
  try {
    const payload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8"),
    ) as SessionPayload;
    return payload.v === 1 && typeof payload.exp === "number" && payload.exp > Date.now();
  } catch {
    return false;
  }
}

export function passwordMatches(input: string): boolean {
  const a = Buffer.from(input);
  const b = Buffer.from(config.appPassword);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function cookieSecure(): boolean {
  // 仅在确有 HTTPS 时开启；纯 HTTP（当前阿里云 IP 访问）必须为 false，否则浏览器不存 Cookie
  const raw = process.env.COOKIE_SECURE;
  if (raw === undefined || raw === "") return false;
  return raw === "1" || raw.toLowerCase() === "true" || raw === "yes";
}

export function setSessionCookie(c: Context, token: string) {
  setCookie(c, config.cookieName, token, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge: Math.floor(config.sessionTtlMs / 1000),
    secure: cookieSecure(),
  });
}

export function clearSessionCookie(c: Context) {
  deleteCookie(c, config.cookieName, {
    path: "/",
    secure: cookieSecure(),
  });
}

export async function requireAuth(c: Context, next: Next) {
  const token = getCookie(c, config.cookieName);
  if (!verifySessionToken(token)) {
    return c.json({ error: "未登录" }, 401);
  }
  await next();
}
