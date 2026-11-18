import { config } from "./config.js";
import { chatCompletion } from "./deepseek.js";
import {
  countUserMessages,
  getSetting,
  recentMessages,
  setSetting,
} from "./db.js";
import { shanghaiYmd } from "./followup.js";

export type ContinuityState = {
  ymd: string;
  threads: string[];
  userMsgAtExtract: number;
};

const SETTINGS_YMD = "continuity_ymd";
const SETTINGS_JSON = "continuity_json";
const SETTINGS_USER_COUNT = "continuity_user_count";
const MAX_THREADS = 4;
/** 同日每累计这么多用户消息轻刷一次 */
const REFRESH_EVERY_USER = 8;

export function parseContinuityJson(
  raw: string,
  ymd: string,
  userMsgAtExtract = 0,
): ContinuityState | null {
  try {
    const data = JSON.parse(raw) as { threads?: unknown };
    const threads = Array.isArray(data.threads)
      ? data.threads
          .filter((t): t is string => typeof t === "string")
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, MAX_THREADS)
      : [];
    return { ymd, threads, userMsgAtExtract };
  } catch {
    return null;
  }
}

export function formatContinuity(state: ContinuityState): string {
  if (!state.threads.length) return "";
  return state.threads.map((t, i) => `${i + 1}. ${t}`).join("\n");
}

export function readStoredContinuity(
  ymd = shanghaiYmd(),
): ContinuityState | null {
  if (getSetting(SETTINGS_YMD) !== ymd) return null;
  const raw = getSetting(SETTINGS_JSON);
  if (!raw) return null;
  const count = Number(getSetting(SETTINGS_USER_COUNT) || "0");
  return parseContinuityJson(
    raw,
    ymd,
    Number.isFinite(count) ? count : 0,
  );
}

function writeContinuity(state: ContinuityState): void {
  setSetting(SETTINGS_YMD, state.ymd);
  setSetting(SETTINGS_JSON, JSON.stringify({ threads: state.threads }));
  setSetting(SETTINGS_USER_COUNT, String(state.userMsgAtExtract));
}

async function extractThreads(ymd: string): Promise<string[]> {
  const recent = recentMessages(config.recentTurns * 2);
  if (recent.length < 2) return [];

  const transcript = recent
    .map((m) => {
      const who =
        m.role === "user" ? "用户" : m.is_proactive ? "她(主动)" : "她";
      return `${who}: ${m.content}`;
    })
    .join("\n");

  const raw = await chatCompletion(
    [
      {
        role: "system",
        content: `你在整理恋人微信里「还没说完、今天还能接着聊」的小事。
只输出 JSON：{"threads":["短句1","短句2"]}
要求：
- 2～4 条；没有就 []
- 只写对话里出现过的未完结事（约了什么、还饿着、在烦什么、说好要做还没做…）
- 短句，不要提问，不要编造
- 不要写成任务清单口吻`,
      },
      {
        role: "user",
        content: `日期（上海）：${ymd}\n最近对话：\n${transcript}\n\n请输出 JSON：`,
      },
    ],
    { temperature: 0.3, maxTokens: 180 },
  );

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return [];
  const parsed = parseContinuityJson(match[0], ymd, 0);
  return parsed?.threads ?? [];
}

function needsRefresh(force: boolean, ymd: string): boolean {
  if (force) return true;
  const stored = readStoredContinuity(ymd);
  if (!stored) return true;
  const userCount = countUserMessages();
  if (userCount - stored.userMsgAtExtract >= REFRESH_EVERY_USER) return true;
  return false;
}

/** 跨日或 force 或累计用户消息够多时重抽。 */
export async function ensureContinuityThreads(
  force = false,
): Promise<ContinuityState> {
  const ymd = shanghaiYmd();
  if (!needsRefresh(force, ymd)) {
    return readStoredContinuity(ymd)!;
  }

  const userCount = countUserMessages();
  try {
    const threads = await extractThreads(ymd);
    const state: ContinuityState = {
      ymd,
      threads,
      userMsgAtExtract: userCount,
    };
    writeContinuity(state);
    console.log("[continuity] updated", { count: threads.length });
    return state;
  } catch (err) {
    console.error("[continuity] extract failed", err);
    const existing = readStoredContinuity(ymd);
    if (existing) return existing;
    const empty: ContinuityState = {
      ymd,
      threads: [],
      userMsgAtExtract: userCount,
    };
    writeContinuity(empty);
    return empty;
  }
}

export function getContinuityText(): string {
  const state = readStoredContinuity();
  if (!state) return "";
  return formatContinuity(state);
}
