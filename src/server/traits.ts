/** 性格慢变量：0～1，极少改，不进每日剧情。 */

export type PersonalityTraits = {
  cling: number;
  chatter: number;
  heavySensitivity: number;
  reserve: number;
  /** 高 = 更夜猫（晚高早低） */
  chronotype: number;
};

/** 恋人向默认（对齐 design spec） */
export const DEFAULT_TRAITS: PersonalityTraits = {
  cling: 0.7,
  chatter: 0.65,
  heavySensitivity: 0.8,
  reserve: 0.55,
  chronotype: 0.75,
};

export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export function normalizeTraits(
  partial: Partial<PersonalityTraits> | null | undefined,
): PersonalityTraits {
  const base = DEFAULT_TRAITS;
  return {
    cling: clamp01(partial?.cling ?? base.cling),
    chatter: clamp01(partial?.chatter ?? base.chatter),
    heavySensitivity: clamp01(
      partial?.heavySensitivity ?? base.heavySensitivity,
    ),
    reserve: clamp01(partial?.reserve ?? base.reserve),
    chronotype: clamp01(partial?.chronotype ?? base.chronotype),
  };
}
