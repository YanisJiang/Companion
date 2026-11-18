/** 回合节奏纯逻辑：单测覆盖这里，调度器只接线。 */

export const MAX_BUBBLES = 3;
/** 短于等于此字数的泡并入上一条，避免词碎片 */
export const MIN_BUBBLE_CHARS = 2;
/** 停发后安静多久再回（连发会重置） */
export const QUIET_MIN_MS = 1_500;
export const QUIET_MAX_MS = 3_000;
/** 已攒较多短泡时稍短一点 */
export const QUIET_MANY_MIN_MS = 1_200;
export const QUIET_MANY_MAX_MS = 2_000;

export function isNudge(text: string): boolean {
  return /不理我|在吗|回我|说话|怎么不|理一下|理我|^喂$|^\?$|^？$/.test(
    text.trim(),
  );
}

export function quietDelayMs(
  pending: string[],
  rand: () => number = Math.random,
): number {
  const last = pending[pending.length - 1] ?? "";
  if (isNudge(last)) return 0;
  const pick = (min: number, max: number) => min + rand() * (max - min);
  if (pending.length >= 3) {
    return pick(QUIET_MANY_MIN_MS, QUIET_MANY_MAX_MS);
  }
  return pick(QUIET_MIN_MS, QUIET_MAX_MS);
}

/** 把过短片段并进上一条，再截到 MAX_BUBBLES。 */
export function coalesceShortBubbles(
  parts: string[],
  minChars = MIN_BUBBLE_CHARS,
): string[] {
  const out: string[] = [];
  for (const raw of parts) {
    const p = raw.trim();
    if (!p) continue;
    if (out.length && [...p].length <= minChars) {
      out[out.length - 1] = `${out[out.length - 1]}${p}`;
      continue;
    }
    out.push(p);
  }
  return out.slice(0, MAX_BUBBLES);
}

export function splitBubbles(text: string): string[] {
  const raw = text.trim();
  if (!raw) return [];
  const parts = raw
    .split(/\n\s*---\s*\n|\n---\n|^---\n|\n---$/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length <= 1) {
    const lines = raw
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (lines.length > 1) return coalesceShortBubbles(lines);
    return [raw];
  }
  return coalesceShortBubbles(parts);
}

/**
 * 是否该立刻回（催促）还是先等安静窗。
 * 确定性：不调用模型。
 */
export function shouldReplyImmediately(pending: string[]): boolean {
  if (!pending.length) return false;
  return isNudge(pending[pending.length - 1] ?? "");
}
