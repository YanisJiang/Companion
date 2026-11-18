import { getSetting, recentMessages, setSetting } from "./db.js";
import {
  isHeavyMoodText,
  isInHeavyCooldown,
  textsHaveHeavyMood,
} from "./crisis.js";

export type InitiativeTone = "silence" | "presence" | "life";

/** 连续未回主动达到该数后，当天不再主动（你开口或次日清零） */
export const UNANSWERED_STREAK_CAP = 2;

const STREAK_KEY = "unanswered_initiative_streak";
const STREAK_YMD_KEY = "unanswered_initiative_ymd";
/** 旧永久闸门 key，启动后读写时顺带清掉 */
const LEGACY_AWAITING_KEY = "awaiting_user_after_initiative";

/** 软沉重：未到危机词，但也不该切日常碎碎念 */
const SOFT_HEAVY_RE = /难受|崩溃|想哭|撑不住|好累|委屈|心堵|绝望|没钱了/;

export function shanghaiYmdLocal(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** 跨日则视为 0 */
export function effectiveUnansweredStreak(
  streak: number,
  storedYmd: string,
  todayYmd: string,
): number {
  if (!storedYmd || storedYmd !== todayYmd) return 0;
  if (!Number.isFinite(streak) || streak < 0) return 0;
  return Math.floor(streak);
}

export function canAttemptWithStreak(
  streak: number,
  cap: number = UNANSWERED_STREAK_CAP,
): boolean {
  return streak < cap;
}

export function getUnansweredInitiativeStreak(
  todayYmd: string = shanghaiYmdLocal(),
): number {
  // 顺带清掉旧永久闸，避免脏配置干扰排查
  if (getSetting(LEGACY_AWAITING_KEY) === "1") {
    setSetting(LEGACY_AWAITING_KEY, "0");
  }
  const raw = Number(getSetting(STREAK_KEY) || "0");
  const storedYmd = getSetting(STREAK_YMD_KEY) || "";
  return effectiveUnansweredStreak(raw, storedYmd, todayYmd);
}

/** 她主动发出一条且你尚未回：streak+1 */
export function noteUnansweredInitiative(
  todayYmd: string = shanghaiYmdLocal(),
): number {
  const next = getUnansweredInitiativeStreak(todayYmd) + 1;
  setSetting(STREAK_YMD_KEY, todayYmd);
  setSetting(STREAK_KEY, String(next));
  setSetting(LEGACY_AWAITING_KEY, "0");
  return next;
}

/** 你开口：清零连续未回 */
export function clearUnansweredInitiativeStreak(
  todayYmd: string = shanghaiYmdLocal(),
): void {
  setSetting(STREAK_YMD_KEY, todayYmd);
  setSetting(STREAK_KEY, "0");
  setSetting(LEGACY_AWAITING_KEY, "0");
}

export function recentUserTexts(limit = 8): string[] {
  return recentMessages(30)
    .filter((m) => m.role === "user")
    .slice(-limit)
    .map((m) => m.content);
}

/**
 * 主动前情境：是否发、发陪伴还是发生活。
 * heavy/crisis：禁止 life；默认 silence，偶发 presence。
 */
export function decideInitiativeTone(
  userTexts: string[] = recentUserTexts(),
  rand: () => number = Math.random,
): InitiativeTone {
  if (isInHeavyCooldown() || textsHaveHeavyMood(userTexts)) {
    return rand() < 0.12 ? "presence" : "silence";
  }
  if (userTexts.some((t) => SOFT_HEAVY_RE.test(t) || isHeavyMoodText(t))) {
    return rand() < 0.55 ? "presence" : "silence";
  }
  return "life";
}

export function canAttemptInitiative(): boolean {
  return canAttemptWithStreak(getUnansweredInitiativeStreak());
}
