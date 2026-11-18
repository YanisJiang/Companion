import { config } from "./config.js";
import { generateProactiveMessage } from "./chat.js";
import {
  getSetting,
  hasProactiveOnLocalDate,
  hasUserMessageOnLocalDate,
  insertMessage,
  setSetting,
} from "./db.js";
import { shanghaiYmd, tickIdlePing } from "./followup.js";
import { ensureContinuityThreads } from "./continuity.js";
import { ensureTodayState } from "./today.js";

function localHour(d = new Date()): number {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    hour: "numeric",
    hour12: false,
  }).format(d);
  return Number(hour);
}

async function tickDailyGreeting() {
  const enabled = getSetting("proactive_enabled") === "1";
  if (!enabled) return;

  const hour = localHour();
  const start = config.proactiveHourStart;
  const end = config.proactiveHourEnd;
  const inWindow =
    start === end
      ? true
      : start < end
        ? hour >= start && hour < end
        : hour >= start || hour < end;

  if (!inWindow) return;

  const today = shanghaiYmd();
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

export async function tickProactive() {
  await ensureTodayState();
  await ensureContinuityThreads();
  await tickIdlePing();
  await tickDailyGreeting();
}

export function startProactiveLoop() {
  const run = () => {
    void tickProactive();
  };
  run();
  return setInterval(run, 60_000);
}
