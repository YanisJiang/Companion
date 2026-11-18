import {
  clamp01,
  DEFAULT_TRAITS,
  type PersonalityTraits,
} from "./traits.js";

/** 快变量：生理/情境 */
export type CompanionState = {
  energy: number;
  mood: number;
  socialDrive: number;
  crisisResidue: number;
  /** 上次 tick 的 epoch ms；0 表示未知 */
  updatedAt: number;
};

export const STATE_SETTINGS_KEY = "companion_state_json";

export function createInitialState(now = Date.now()): CompanionState {
  return {
    energy: 0.7,
    mood: 0.65,
    socialDrive: 0.35,
    crisisResidue: 0,
    updatedAt: now,
  };
}

export function parseCompanionState(
  raw: string,
  now = Date.now(),
): CompanionState | null {
  if (!raw?.trim()) return null;
  try {
    const data = JSON.parse(raw) as Partial<CompanionState>;
    return {
      energy: clamp01(Number(data.energy)),
      mood: clamp01(Number(data.mood)),
      socialDrive: clamp01(Number(data.socialDrive)),
      crisisResidue: clamp01(Number(data.crisisResidue)),
      updatedAt:
        Number.isFinite(Number(data.updatedAt)) && Number(data.updatedAt) > 0
          ? Number(data.updatedAt)
          : now,
    };
  } catch {
    return null;
  }
}

export function serializeCompanionState(state: CompanionState): string {
  return JSON.stringify({
    energy: clamp01(state.energy),
    mood: clamp01(state.mood),
    socialDrive: clamp01(state.socialDrive),
    crisisResidue: clamp01(state.crisisResidue),
    updatedAt: state.updatedAt,
  });
}

/** 上海小时 0–23 → 精力基线；chronotype 高则晚间更高、清晨更低 */
export function energyBaselineForHour(
  hour: number,
  chronotype: number,
): number {
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  // 夜猫：23–2 高，6–10 低；日猫反向轻一点
  const nightPeak = h >= 22 || h < 2 ? 0.85 : h >= 18 ? 0.75 : h < 6 ? 0.45 : h < 11 ? 0.4 : 0.65;
  const dayPeak = h >= 9 && h < 17 ? 0.8 : h < 7 ? 0.5 : 0.6;
  return clamp01(nightPeak * chronotype + dayPeak * (1 - chronotype));
}

/**
 * 按墙钟推进状态（纯函数）。
 * dtMs 过大时按小时分片，避免一次跳变失控。
 */
export function tickState(
  state: CompanionState,
  traits: PersonalityTraits = DEFAULT_TRAITS,
  dtMs: number,
  hour: number,
  now = Date.now(),
): CompanionState {
  const dt = Math.max(0, dtMs);
  if (dt === 0) {
    return { ...state, updatedAt: now };
  }

  const hours = Math.min(dt / 3_600_000, 12);
  const baseline = energyBaselineForHour(hour, traits.chronotype);

  // 精力向时段基线靠拢
  let energy = state.energy + (baseline - state.energy) * Math.min(1, hours * 0.35);
  // 空闲回升一点社交欲（黏人涨得快）
  const socialRisePerHour = 0.08 + traits.cling * 0.14;
  let socialDrive = state.socialDrive + socialRisePerHour * hours;
  // 心情缓慢回中
  let mood = state.mood + (0.6 - state.mood) * Math.min(1, hours * 0.15);
  // 危机残留衰减：敏感越高衰减越慢
  const crisisHalfLifeH = 0.5 + traits.heavySensitivity * 1.5;
  const crisisDecay = Math.pow(0.5, hours / crisisHalfLifeH);
  let crisisResidue = state.crisisResidue * crisisDecay;

  return {
    energy: clamp01(energy),
    mood: clamp01(mood),
    socialDrive: clamp01(socialDrive),
    crisisResidue: clamp01(crisisResidue),
    updatedAt: now,
  };
}

/** 用户开口：危机抬残留；平常略耗精力、回升一点社交欲（你在理她） */
export function onUserMessageState(
  state: CompanionState,
  opts: { heavy?: boolean; softHeavy?: boolean; now?: number },
): CompanionState {
  const now = opts.now ?? Date.now();
  let { energy, mood, socialDrive, crisisResidue } = state;
  energy = clamp01(energy - 0.03);
  socialDrive = clamp01(socialDrive * 0.85 + 0.05);

  if (opts.heavy) {
    crisisResidue = 1;
    mood = clamp01(mood - 0.25);
  } else if (opts.softHeavy) {
    crisisResidue = Math.max(crisisResidue, 0.55);
    mood = clamp01(mood - 0.12);
  }

  return {
    energy,
    mood,
    socialDrive,
    crisisResidue,
    updatedAt: now,
  };
}

/** 主动发出后：扣社交欲 */
export function onInitiativeSentState(
  state: CompanionState,
  now = Date.now(),
): CompanionState {
  return {
    ...state,
    socialDrive: clamp01(state.socialDrive - 0.35),
    energy: clamp01(state.energy - 0.04),
    updatedAt: now,
  };
}

/** 被动回复发出后：轻耗 */
export function onReplySentState(
  state: CompanionState,
  now = Date.now(),
): CompanionState {
  return {
    ...state,
    energy: clamp01(state.energy - 0.05),
    socialDrive: clamp01(state.socialDrive * 0.9),
    updatedAt: now,
  };
}
