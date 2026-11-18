import { config } from "./deps.js";
import {
  getSetting,
  hasProactiveOnLocalDate,
  hasUserMessageOnLocalDate,
  insertMessage,
  setSetting,
} from "./deps.js";
import {
  bumpIdleDueAfterUnanswered,
  canSendInitiative,
  clearIdleDue,
  generateInitiativeText,
  recordInitiative,
  shanghaiYmd,
  tickIdlePing,
} from "./followup.js";
import { ensureDaySchedule, tickClockEvents } from "./clock.js";
import { ensureContinuityThreads } from "./continuity.js";
import {
  applyInitiativeSentToCompanionState,
  ensureCompanionStateTicked,
} from "./companion-runtime.js";
import {
  canAttemptInitiative,
  decideInitiativeIntent,
  noteUnansweredInitiative,
} from "./initiative-context.js";
import { notifyProactivePush } from "./deps.js";
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
  if (!canAttemptInitiative()) {
    console.log("[proactive] skip: unanswered streak cap");
    return;
  }
  if (!canSendInitiative()) return;

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

  ensureCompanionStateTicked();
  const intent = decideInitiativeIntent();
  if (intent === "silence") {
    console.log("[proactive] skip: intent silence");
    return;
  }

  try {
    const text = (await generateInitiativeText(intent)).trim();
    if (!text) return;
    insertMessage("assistant", text, true);
    recordInitiative();
    applyInitiativeSentToCompanionState();
    const streak = noteUnansweredInitiative(today);
    if (streak >= 2) clearIdleDue();
    else bumpIdleDueAfterUnanswered();
    setSetting("last_proactive_date", today);
    void notifyProactivePush(text);
    console.log("[proactive] 已发送主动消息", { intent, streak });
  } catch (err) {
    console.error("[proactive] 失败", err);
  }
}

export async function tickProactive() {
  ensureCompanionStateTicked();
  await ensureTodayState();
  await ensureDaySchedule();
  await ensureContinuityThreads();
  await tickClockEvents();
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
