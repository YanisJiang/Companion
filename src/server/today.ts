import { chatCompletion } from "./deepseek.js";
import { getSetting, setSetting } from "./db.js";
import { shanghaiYmd } from "./followup.js";
import { DEFAULT_DOSSIER } from "./persona.js";

export type TodayState = {
  ymd: string;
  mood: string;
  beats: string[];
};

const SETTINGS_YMD = "today_ymd";
const SETTINGS_JSON = "today_state_json";

export function parseTodayStateJson(
  raw: string,
  ymd: string,
): TodayState | null {
  try {
    const data = JSON.parse(raw) as {
      mood?: unknown;
      beats?: unknown;
    };
    const mood = typeof data.mood === "string" ? data.mood.trim() : "";
    const beats = Array.isArray(data.beats)
      ? data.beats
          .filter((b): b is string => typeof b === "string")
          .map((b) => b.trim())
          .filter(Boolean)
          .slice(0, 2)
      : [];
    if (!mood && !beats.length) return null;
    return {
      ymd,
      mood: mood || "平常",
      beats: beats.length ? beats : ["随便窝着"],
    };
  } catch {
    return null;
  }
}

export function formatTodayState(state: TodayState): string {
  const lines = [`心情：${state.mood}`];
  if (state.beats.length) {
    lines.push(`小事：${state.beats.map((b) => `「${b}」`).join("、")}`);
  }
  return lines.join("\n");
}

export function readStoredTodayState(
  ymd = shanghaiYmd(),
): TodayState | null {
  if (getSetting(SETTINGS_YMD) !== ymd) return null;
  const raw = getSetting(SETTINGS_JSON);
  if (!raw) return null;
  return parseTodayStateJson(raw, ymd);
}

function writeTodayState(state: TodayState): void {
  setSetting(SETTINGS_YMD, state.ymd);
  setSetting(
    SETTINGS_JSON,
    JSON.stringify({ mood: state.mood, beats: state.beats }),
  );
}

function fallbackState(ymd: string): TodayState {
  return {
    ymd,
    mood: "有点迷糊",
    beats: ["窝着发呆", "耳机里放着歌"],
  };
}

async function generateTodayState(ymd: string): Promise<TodayState> {
  const dossier = (getSetting("character_dossier") || DEFAULT_DOSSIER).trim();
  const raw = await chatCompletion(
    [
      {
        role: "system",
        content: `你在给恋人角色生成「今天」的轻量生活状态。只输出 JSON，不要其它字：
{"mood":"两到六字心情","beats":["小事1","小事2"]}
要求：贴合小档案；小事具体、琐碎、可聊；不要宏大剧情；不要写找袜子/手机不在等当延迟借口；beats 1～2 条。`,
      },
      {
        role: "user",
        content: `日期（上海）：${ymd}\n小档案：\n${dossier}\n\n请输出 JSON：`,
      },
    ],
    { temperature: 0.85, maxTokens: 120 },
  );

  const match = raw.match(/\{[\s\S]*\}/);
  const parsed = match ? parseTodayStateJson(match[0], ymd) : null;
  return parsed ?? fallbackState(ymd);
}

/** 同日复用；跨日或 force 时重新生成。 */
export async function ensureTodayState(
  force = false,
): Promise<TodayState> {
  const ymd = shanghaiYmd();
  if (!force) {
    const existing = readStoredTodayState(ymd);
    if (existing) return existing;
  }
  try {
    const state = await generateTodayState(ymd);
    writeTodayState(state);
    console.log("[today] generated", state);
    return state;
  } catch (err) {
    console.error("[today] generate failed", err);
    const fb = fallbackState(ymd);
    writeTodayState(fb);
    return fb;
  }
}

export function getTodayStateText(): string {
  const state = readStoredTodayState();
  if (!state) return "";
  return formatTodayState(state);
}
