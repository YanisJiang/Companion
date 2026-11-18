import { getSetting, setSetting } from "./db.js";

/** 冷静窗时长（命中重情绪后多久不发日常主动） */
export const HEAVY_COOLDOWN_MS = 45 * 60_000;

const HEAVY_RE =
  /想死|自杀|活不下去|结束生命|不想活|去死|重度抑郁|重度焦虑|割腕|跳楼|没人在乎|没人关心我/;

export function isHeavyMoodText(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return HEAVY_RE.test(t);
}

export function textsHaveHeavyMood(texts: string[]): boolean {
  return texts.some((t) => isHeavyMoodText(t));
}

export function getHeavyUntil(): number {
  const raw = Number(getSetting("heavy_until") || "0");
  return Number.isFinite(raw) ? raw : 0;
}

export function isInHeavyCooldown(now = Date.now()): boolean {
  return now < getHeavyUntil();
}

/** 从现在起延长冷静窗（取较晚的到期时间，避免缩短）。 */
export function bumpHeavyCooldown(now = Date.now()): number {
  const until = now + HEAVY_COOLDOWN_MS;
  const prev = getHeavyUntil();
  const next = Math.max(prev, until);
  setSetting("heavy_until", String(next));
  return next;
}

/**
 * 用户新消息：命中则拉冷静窗。
 * onArmed：用于取消待发续话/清空 idle（由 followup 注入，避免循环依赖）。
 */
export function noteUserTextForCrisis(
  text: string,
  onArmed?: () => void,
): void {
  if (!isHeavyMoodText(text)) return;
  const until = bumpHeavyCooldown();
  console.log("[crisis] heavy mood → cooldown until", until);
  onArmed?.();
}
