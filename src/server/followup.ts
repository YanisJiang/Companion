import { chatCompletion } from "./deepseek.js";
import {
  getSetting,
  insertMessage,
  setSetting,
} from "./db.js";
import { isInHeavyCooldown } from "./crisis.js";
import { buildSystemPrompt } from "./prompt.js";
import { ensureTodayState } from "./today.js";

const FOLLOWUP_PROB = 0.2;
const DELAY_MIN_MS = 35_000;
const DELAY_MAX_MS = 90_000;
const DEFAULT_DAILY_CAP = 8;
const CAP_MIN = 0;
const CAP_MAX = 50;
const DEFAULT_IDLE_MIN_MINUTES = 3;
const DEFAULT_IDLE_MAX_MINUTES = 12;
const IDLE_BOUND_MIN = 1;
const IDLE_BOUND_MAX = 120;

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

export function getInitiativeDailyCap(): number {
  const raw = Number(getSetting("initiative_daily_cap") || String(DEFAULT_DAILY_CAP));
  if (!Number.isFinite(raw)) return DEFAULT_DAILY_CAP;
  return Math.max(CAP_MIN, Math.min(CAP_MAX, Math.floor(raw)));
}

export function setInitiativeDailyCap(n: number): number {
  const capped = Math.max(CAP_MIN, Math.min(CAP_MAX, Math.floor(n)));
  setSetting("initiative_daily_cap", String(capped));
  return capped;
}

/** 规范化安静窗：1～120 分钟，且 min≤max。 */
export function normalizeIdleWindow(
  minRaw: number,
  maxRaw: number,
): { min: number; max: number } {
  let min = Math.floor(minRaw);
  let max = Math.floor(maxRaw);
  if (!Number.isFinite(min)) min = DEFAULT_IDLE_MIN_MINUTES;
  if (!Number.isFinite(max)) max = DEFAULT_IDLE_MAX_MINUTES;
  min = Math.max(IDLE_BOUND_MIN, Math.min(IDLE_BOUND_MAX, min));
  max = Math.max(IDLE_BOUND_MIN, Math.min(IDLE_BOUND_MAX, max));
  if (min > max) {
    const t = min;
    min = max;
    max = t;
  }
  return { min, max };
}

export function getIdleWindowMinutes(): { min: number; max: number } {
  const minRaw = Number(
    getSetting("idle_min_minutes") || String(DEFAULT_IDLE_MIN_MINUTES),
  );
  const maxRaw = Number(
    getSetting("idle_max_minutes") || String(DEFAULT_IDLE_MAX_MINUTES),
  );
  return normalizeIdleWindow(minRaw, maxRaw);
}

export function setIdleWindowMinutes(
  minRaw: number,
  maxRaw: number,
): { min: number; max: number } {
  const w = normalizeIdleWindow(minRaw, maxRaw);
  setSetting("idle_min_minutes", String(w.min));
  setSetting("idle_max_minutes", String(w.max));
  return w;
}

function initiativeState(): { ymd: string; count: number } {
  const ymd = shanghaiYmd();
  const stored = getSetting("initiative_ymd");
  if (stored !== ymd) return { ymd, count: 0 };
  const count = Number(getSetting("initiative_count") || "0");
  return { ymd, count: Number.isFinite(count) ? count : 0 };
}

export function getInitiativeUsedToday(): number {
  return initiativeState().count;
}

export function resetInitiativeUsedToday(): void {
  setSetting("initiative_ymd", shanghaiYmd());
  setSetting("initiative_count", "0");
}

export function canSendInitiative(): boolean {
  const cap = getInitiativeDailyCap();
  if (cap <= 0) return false;
  return initiativeState().count < cap;
}

/** 仅在消息真正发出后调用。 */
export function recordInitiative(): boolean {
  const cap = getInitiativeDailyCap();
  const { ymd, count } = initiativeState();
  if (count >= cap) return false;
  setSetting("initiative_ymd", ymd);
  setSetting("initiative_count", String(count + 1));
  return true;
}

/** 用户刚发过消息：重设「安静后找你」的到期时间。 */
export function bumpIdleDue(): void {
  const { min, max } = getIdleWindowMinutes();
  const mins = min + Math.random() * (max - min);
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
  if (isInHeavyCooldown()) {
    console.log("[followup] skip: heavy cooldown");
    return;
  }
  if (!canSendInitiative()) {
    console.log("[followup] skip: daily cap reached", {
      used: getInitiativeUsedToday(),
      cap: getInitiativeDailyCap(),
    });
    return;
  }
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
  if (isInHeavyCooldown()) {
    console.log("[followup] skip run: heavy cooldown");
    return;
  }
  if (!canSendInitiative()) return;

  try {
    await ensureTodayState();
    const text = await chatCompletion([
      { role: "system", content: buildSystemPrompt() },
      {
        role: "user",
        content:
          "（系统）你刚才已经回过用户了。现在补发一条很短的续话：像微信里过一会儿又冒出来的那句。优先轻轻带一句「你今天的状态」里的小事或心情，也可以是当下碎碎念；不要空关心、不要复述刚才已经说过的话、不要提问收尾、不要列表、不要讲道理。只输出这一句正文。",
      },
    ]);
    const cleaned = text.trim();
    if (!cleaned) return;
    insertMessage("assistant", cleaned, true);
    recordInitiative();
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
        "（系统）你们刚聊过，用户安静了一会儿。请主动发一句很短的消息：优先轻轻带一句「你今天的状态」里的小事或心情，也可以是惦记或接一下刚才的氛围。不要提问收尾；不要列表；不要讲道理；不要长篇。只输出一句正文。",
    },
  ]);
}

export async function tickIdlePing(): Promise<void> {
  if (getSetting("proactive_enabled") !== "1") return;
  const dueRaw = getSetting("idle_due_at");
  if (!dueRaw) return;
  const due = Number(dueRaw);
  if (!Number.isFinite(due) || Date.now() < due) return;
  if (isInHeavyCooldown()) {
    console.log("[idle] skip: heavy cooldown");
    clearIdleDue();
    return;
  }
  if (!canSendInitiative()) {
    console.log("[idle] skip: daily cap reached", {
      used: getInitiativeUsedToday(),
      cap: getInitiativeDailyCap(),
    });
    clearIdleDue();
    return;
  }
  clearIdleDue();
  try {
    await ensureTodayState();
    const text = (await generateIdlePing()).trim();
    if (!text) return;
    insertMessage("assistant", text, true);
    recordInitiative();
    console.log("[idle] 已发送安静后主动消息");
  } catch (err) {
    console.error("[idle] 失败", err);
  }
}
