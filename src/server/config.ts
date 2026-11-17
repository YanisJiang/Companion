import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadDotEnv() {
  const path = resolve(process.cwd(), ".env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadDotEnv();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`缺少环境变量 ${name}`);
  return value;
}

function bool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return raw === "1" || raw.toLowerCase() === "true" || raw === "yes";
}

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  port: int("PORT", 8787),
  appPassword: required("APP_PASSWORD", "change-me"),
  sessionSecret: required("SESSION_SECRET", "dev-session-secret-change-me"),
  deepseekApiKey: process.env.DEEPSEEK_API_KEY ?? "",
  deepseekBaseUrl: required("DEEPSEEK_BASE_URL", "https://api.deepseek.com"),
  deepseekModel: required("DEEPSEEK_MODEL", "deepseek-chat"),
  companionName: required("COMPANION_NAME", "阿深"),
  userNickname: required("USER_NICKNAME", "你"),
  proactiveEnabled: bool("PROACTIVE_ENABLED", true),
  proactiveHourStart: int("PROACTIVE_HOUR_START", 21),
  proactiveHourEnd: int("PROACTIVE_HOUR_END", 22),
  dataDir: resolve(process.cwd(), process.env.DATA_DIR ?? "./data"),
  recentTurns: 20,
  summarizeEveryUserMessages: 12,
  cookieName: "companion_session",
  sessionTtlMs: 1000 * 60 * 60 * 24 * 14,
};
