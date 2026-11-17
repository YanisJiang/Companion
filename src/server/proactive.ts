import { config } from "./config.js";
import { generateProactiveMessage } from "./chat.js";
import {
  getSetting,
  hasProactiveOnLocalDate,
  hasUserMessageOnLocalDate,
  insertMessage,
  setSetting,
} from "./db.js";

function localYmd(d = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${day}`;
}

function localHour(d = new Date()): number {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    hour: "numeric",
    hour12: false,
  }).format(d);
  return Number(hour);
}

export async function tickProactive() {
  const enabled = getSetting("proactive_enabled") === "1";
  if (!enabled) return;

  const hour = localHour();
  const start = config.proactiveHourStart;
  const end = config.proactiveHourEnd;
  const inWindow =
    start === end ? true : start < end ? hour >= start && hour < end : hour >= start || hour < end;

  if (!inWindow) return;

  const today = localYmd();
  if (getSetting("last_proactive_date") === today) return;
  if (hasProactiveOnLocalDate(today)) {
    setSetting("last_proactive_date", today);
    return;
  }
  if (hasUserMessageOnLocalDate(today)) return;

  try {
    const text = await generateProactiveMessage();
    insertMessage("assistant", text, true);
    setSetting("last_proactive_date", today);
    console.log("[proactive] 已发送主动消息");
  } catch (err) {
    console.error("[proactive] 失败", err);
  }
}

export function startProactiveLoop() {
  const run = () => {
    void tickProactive();
  };
  run();
  return setInterval(run, 60_000);
}
