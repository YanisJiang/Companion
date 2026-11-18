import { chatCompletion } from "./deepseek.js";
import {
  getSetting,
  insertMessage,
  setSetting,
} from "./db.js";
import { buildSystemPrompt } from "./prompt.js";

const FOLLOWUP_PROB = 0.35;
const DELAY_MIN_MS = 20_000;
const DELAY_MAX_MS = 60_000;
const DAILY_CAP = 4;
const IDLE_MIN_MINUTES = 3;
const IDLE_MAX_MINUTES = 12;

let followupTimer: ReturnType<typeof setTimeout> | null = null;
let followupGen = 0;

export function shanghaiYmd(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function initiativeState(): { ymd: string; count: number } {
  const ymd = shanghaiYmd();
  const stored = getSetting("initiative_ymd");
  if (stored !== ymd) return { ymd, count: 0 };
  const count = Number(getSetting("initiative_count") || "0");
  return { ymd, count: Number.isFinite(count) ? count : 0 };
}

export function canSendInitiative(): boolean {
  return initiativeState().count < DAILY_CAP;
}

export function recordInitiative(): boolean {
  const { ymd, count } = initiativeState();
  if (count >= DAILY_CAP) return false;
  setSetting("initiative_ymd", ymd);
  setSetting("initiative_count", String(count + 1));
  return true;
}

/** 用户刚发过消息：重设「安静后找你」的到期时间。 */
export function bumpIdleDue(): void {
  const mins =
    IDLE_MIN_MINUTES +
    Math.random() * (IDLE_MAX_MINUTES - IDLE_MIN_MINUTES);
  setSetting("idle_due_at", String(Date.now() + mins * 60_000));
}

export function clearIdleDue(): void {
  setSetting("idle_due_at", "");
}

export function cancelPendingFollowup(): void {
  followupGen += 1;
  if (followupTimer) {
    clearTimeout(followupTimer);
    followupTimer = null;
  }
}

export function scheduleFollowupAfterReply(): void {
  if (getSetting("proactive_enabled") !== "1") return;
  if (!canSendInitiative()) return;
  if (Math.random() > FOLLOWUP_PROB) return;

  cancelPendingFollowup();
  const gen = followupGen;
  const delay =
    DELAY_MIN_MS + Math.random() * (DELAY_MAX_MS - DELAY_MIN_MS);

  followupTimer = setTimeout(() => {
    void runFollowup(gen);
  }, delay);
}

async function runFollowup(gen: number): Promise<void> {
  if (gen !== followupGen) return;
  if (getSetting("proactive_enabled") !== "1") return;
  if (!canSendInitiative()) return;
  if (!recordInitiative()) return;

  try {
    const text = await chatCompletion([
      { role: "system", content: buildSystemPrompt() },
      {
        role: "user",
        content:
          "（系统）你刚才已经回过用户了。现在补发一条很短的续话：像微信里过几秒又冒出来的那句。偏你自己的碎碎念、小细节或轻轻惦记；不要提问收尾；不要列表；不要讲道理；不要重复刚才已经说过的话。只输出这一句正文。",
      },
    ]);
    const cleaned = text.trim();
    if (!cleaned) return;
    insertMessage("assistant", cleaned, true);
    console.log("[followup] 已发送续话");
  } catch (err) {
    console.error("[followup] 失败", err);
  }
}

export async function generateIdlePing(): Promise<string> {
  return chatCompletion([
    { role: "system", content: buildSystemPrompt() },
    {
      role: "user",
      content:
        "（系统）你们刚聊过，用户安静了一会儿。请主动发一句很短的消息：可以是你正在做的小事、一句惦记，或轻轻接一下刚才的氛围。不要提问收尾；不要列表；不要讲道理；不要长篇。只输出一句正文。",
    },
  ]);
}

export async function tickIdlePing(): Promise<void> {
  if (getSetting("proactive_enabled") !== "1") return;
  const dueRaw = getSetting("idle_due_at");
  if (!dueRaw) return;
  const due = Number(dueRaw);
  if (!Number.isFinite(due) || Date.now() < due) return;
  if (!canSendInitiative()) {
    clearIdleDue();
    return;
  }
  if (!recordInitiative()) {
    clearIdleDue();
    return;
  }
  clearIdleDue();
  try {
    const text = (await generateIdlePing()).trim();
    if (!text) return;
    insertMessage("assistant", text, true);
    console.log("[idle] 已发送安静后主动消息");
  } catch (err) {
    console.error("[idle] 失败", err);
  }
}
