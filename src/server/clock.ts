import { chatCompletion } from "./deepseek.js";
import { getSetting, insertMessage, setSetting } from "./db.js";
import {
  bumpIdleDueAfterUnanswered,
  canSendInitiative,
  clearIdleDue,
  recordInitiative,
  shanghaiYmd,
} from "./followup.js";
import {
  canAttemptInitiative,
  decideInitiativeTone,
  noteUnansweredInitiative,
} from "./initiative-context.js";
import { DEFAULT_DOSSIER } from "./persona.js";
import { notifyProactivePush } from "./push.js";
import { readStoredTodayState } from "./today.js";

export type ScheduleEvent = {
  hour: number;
  minute: number;
  label: string;
  fired: boolean;
  pinged: boolean;
};

const SETTINGS_YMD = "day_schedule_ymd";
const SETTINGS_JSON = "day_schedule_json";
const PING_ENABLED_KEY = "clock_ping_enabled";
/** 到点后发主动的概率 */
const PING_PROB = 0.35;

export function isClockPingEnabled(): boolean {
  const raw = getSetting(PING_ENABLED_KEY);
  if (raw === "") return true;
  return raw !== "0";
}

export function setClockPingEnabled(on: boolean): void {
  setSetting(PING_ENABLED_KEY, on ? "1" : "0");
}

export function parseScheduleJson(
  raw: string,
  ymd: string,
): ScheduleEvent[] | null {
  try {
    const data = JSON.parse(raw) as { events?: unknown; ymd?: unknown };
    const list = Array.isArray(data.events)
      ? data.events
      : Array.isArray(data)
        ? data
        : null;
    if (!list) return null;
    const events: ScheduleEvent[] = [];
    for (const item of list) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const hour = Number(row.hour);
      const minute = Number(row.minute ?? 0);
      const label = typeof row.label === "string" ? row.label.trim() : "";
      if (!Number.isFinite(hour) || hour < 0 || hour > 23) continue;
      if (!Number.isFinite(minute) || minute < 0 || minute > 59) continue;
      if (!label) continue;
      events.push({
        hour: Math.floor(hour),
        minute: Math.floor(minute),
        label: label.slice(0, 40),
        fired: Boolean(row.fired),
        pinged: Boolean(row.pinged),
      });
    }
    if (!events.length) return null;
    events.sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
    return events.slice(0, 5);
  } catch {
    return null;
  }
}

export function formatSchedule(events: ScheduleEvent[], ymd: string): string {
  if (!events.length) return "";
  const lines = events.map((e) => {
    const hh = String(e.hour).padStart(2, "0");
    const mm = String(e.minute).padStart(2, "0");
    const flag = e.fired ? "已发生" : "计划中";
    return `${hh}:${mm} ${e.label}（${flag}）`;
  });
  return `日期 ${ymd}\n${lines.join("\n")}`;
}

export function getScheduleText(ymd = shanghaiYmd()): string {
  const events = readStoredSchedule(ymd);
  if (!events?.length) return "";
  return formatSchedule(events, ymd);
}

export function shanghaiParts(d = new Date()): {
  ymd: string;
  hour: number;
  minute: number;
} {
  const ymd = shanghaiYmd(d);
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Shanghai",
      hour: "numeric",
      hour12: false,
    }).format(d),
  );
  const minute = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Shanghai",
      minute: "numeric",
    }).format(d),
  );
  return { ymd, hour, minute };
}

/** 纯函数：把已到点且未 fired 的标成 fired，返回新列表与刚到点的事件 */
export function advanceDueEvents(
  events: ScheduleEvent[],
  hour: number,
  minute: number,
): { events: ScheduleEvent[]; newlyFired: ScheduleEvent[] } {
  const nowMins = hour * 60 + minute;
  const newlyFired: ScheduleEvent[] = [];
  const next = events.map((e) => {
    const due = e.hour * 60 + e.minute <= nowMins;
    if (due && !e.fired) {
      const updated = { ...e, fired: true };
      newlyFired.push(updated);
      return updated;
    }
    return e;
  });
  return { events: next, newlyFired };
}

export function readStoredSchedule(
  ymd = shanghaiYmd(),
): ScheduleEvent[] | null {
  if (getSetting(SETTINGS_YMD) !== ymd) return null;
  const raw = getSetting(SETTINGS_JSON);
  if (!raw) return null;
  return parseScheduleJson(raw, ymd);
}

function writeSchedule(ymd: string, events: ScheduleEvent[]): void {
  setSetting(SETTINGS_YMD, ymd);
  setSetting(
    SETTINGS_JSON,
    JSON.stringify({
      ymd,
      events: events.map((e) => ({
        hour: e.hour,
        minute: e.minute,
        label: e.label,
        fired: e.fired,
        pinged: e.pinged,
      })),
    }),
  );
}

function fallbackSchedule(ymd: string): ScheduleEvent[] {
  return [
    { hour: 9, minute: 10, label: "迷糊醒一下", fired: false, pinged: false },
    { hour: 12, minute: 20, label: "随便对付午饭", fired: false, pinged: false },
    { hour: 15, minute: 30, label: "耳机里听歌发呆", fired: false, pinged: false },
    { hour: 19, minute: 40, label: "点个外卖或热饭", fired: false, pinged: false },
    { hour: 22, minute: 15, label: "躺着刷手机", fired: false, pinged: false },
  ];
}

async function generateSchedule(ymd: string): Promise<ScheduleEvent[]> {
  const dossier = (getSetting("character_dossier") || DEFAULT_DOSSIER).trim();
  const today = readStoredTodayState(ymd);
  const moodHint = today
    ? `今日心情：${today.mood}；小事：${today.beats.join("、")}`
    : "今日心情平常";
  const raw = await chatCompletion(
    [
      {
        role: "system",
        content: `你在给恋人角色排「今天」轻量时刻表。只输出 JSON，不要其它字：
{"events":[{"hour":9,"minute":15,"label":"短句小事"}]}
要求：3～5 条；hour 0～23、minute 0～59；按时间升序；贴合小档案与今日心情；琐碎可聊；不要宏大剧情；不要找袜子/手机不在等借口。`,
      },
      {
        role: "user",
        content: `日期（上海）：${ymd}\n${moodHint}\n小档案：\n${dossier}\n\n请输出 JSON：`,
      },
    ],
    { temperature: 0.85, maxTokens: 220 },
  );
  const match = raw.match(/\{[\s\S]*\}/);
  const parsed = match ? parseScheduleJson(match[0], ymd) : null;
  if (!parsed?.length) return fallbackSchedule(ymd);
  return parsed.map((e) => ({ ...e, fired: false, pinged: false }));
}

/** 同日复用；force 时重滚。生成后按当前时间把已过点的标成已发生（不 ping）。 */
export async function ensureDaySchedule(
  force = false,
  now = new Date(),
): Promise<ScheduleEvent[]> {
  const { ymd, hour, minute } = shanghaiParts(now);
  if (!force) {
    const existing = readStoredSchedule(ymd);
    if (existing) return existing;
  }
  let events: ScheduleEvent[];
  try {
    events = await generateSchedule(ymd);
  } catch (err) {
    console.error("[clock] generate failed", err);
    events = fallbackSchedule(ymd);
  }
  // 生成瞬间：已过点的直接标 fired，避免半夜生成白天事件再狂 ping
  const advanced = advanceDueEvents(events, hour, minute);
  events = advanced.events.map((e) =>
    e.fired ? { ...e, pinged: true } : e,
  );
  writeSchedule(ymd, events);
  console.log("[clock] schedule ready", { ymd, n: events.length });
  return events;
}

async function pingForEvent(label: string): Promise<boolean> {
  if (!isClockPingEnabled()) return false;
  if (getSetting("proactive_enabled") !== "1") return false;
  if (!canAttemptInitiative()) return false;
  if (!canSendInitiative()) return false;
  const tone = decideInitiativeTone();
  if (tone === "silence") return false;
  if (Math.random() > PING_PROB) return false;

  const prompt =
    tone === "presence"
      ? `（系统）到点事件「${label}」刚发生。用户近期偏沉重。只发一句极短在场，提到你在做这件事的感觉即可，不要提问，不要日常碎碎念堆砌。只输出一句正文。`
      : `（系统）你日程里的「${label}」到点了。像微信随口冒一句，带一点这件事，不要提问收尾，不要列表。只输出一句正文。`;

  try {
    // 动态 import，避免与 prompt→clock 循环依赖
    const { buildSystemPrompt } = await import("./prompt.js");
    const text = (
      await chatCompletion([
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: prompt },
      ])
    ).trim();
    if (!text) return false;
    insertMessage("assistant", text, true);
    recordInitiative();
    const streak = noteUnansweredInitiative();
    if (streak >= 2) clearIdleDue();
    else bumpIdleDueAfterUnanswered();
    void notifyProactivePush(text);
    console.log("[clock] pinged", { label, tone });
    return true;
  } catch (err) {
    console.error("[clock] ping failed", err);
    return false;
  }
}

/** 每分钟：推进到点事件；可选发 1 条主动（每事件最多一次）。 */
export async function tickClockEvents(now = new Date()): Promise<void> {
  const { ymd, hour, minute } = shanghaiParts(now);
  const events = await ensureDaySchedule(false, now);
  const { events: next, newlyFired } = advanceDueEvents(events, hour, minute);
  if (!newlyFired.length && next.every((e, i) => e === events[i])) {
    // 无变化
    return;
  }

  let working = next;
  for (const due of newlyFired) {
    const idx = working.findIndex(
      (e) =>
        e.hour === due.hour &&
        e.minute === due.minute &&
        e.label === due.label,
    );
    if (idx < 0) continue;
    // 无论是否真正发出，都记 pinged，保证「单事件最多尝试 1 次」
    if (!working[idx].pinged) {
      await pingForEvent(due.label);
    }
    working = working.map((e, i) =>
      i === idx ? { ...e, fired: true, pinged: true } : e,
    );
  }

  writeSchedule(ymd, working);
}
