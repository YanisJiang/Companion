import type { CompanionState } from "./companion-state.js";
import {
  DEFAULT_TRAITS,
  type PersonalityTraits,
} from "./traits.js";

export type InitiativeIntent =
  | "silence"
  | "presence"
  | "life"
  | "check_in"
  | "heavy_hold";

export type ReplyIntent = "reply_normal" | "reply_soft";

export type Intent = InitiativeIntent | ReplyIntent;

/** 主动决策可选上下文（纯数据，便于单测） */
export type DecideInitiativeOpts = {
  /** 近期有未完线可续 */
  hasOpenThread?: boolean;
  /** 未回主动条数（安全帽仍可在外层；此处影响更易 silence） */
  unansweredStreak?: number;
  rand?: () => number;
};

/**
 * 主动意图：危机高禁 life；社交欲/精力/性格决定档位。
 */
export function decideInitiative(
  state: CompanionState,
  traits: PersonalityTraits = DEFAULT_TRAITS,
  opts: DecideInitiativeOpts = {},
): InitiativeIntent {
  const rand = opts.rand ?? Math.random;
  const streak = opts.unansweredStreak ?? 0;

  // 危机残留：只允许沉重陪伴或沉默（偏 heavy_hold，仍禁 life；避免长期假死）
  if (state.crisisResidue >= 0.45) {
    if (state.crisisResidue >= 0.7) {
      return rand() < 0.42 + traits.cling * 0.2 ? "heavy_hold" : "silence";
    }
    return rand() < 0.55 + traits.cling * 0.25 ? "heavy_hold" : "silence";
  }

  // 未回多 + 黏人不高 → 更容易歇着
  const streakPenalty = streak >= 1 ? 0.2 + (1 - traits.cling) * 0.25 : 0;
  const drive = state.socialDrive - streakPenalty;

  if (drive < 0.28 || state.energy < 0.22) {
    return "silence";
  }

  // 低精力：最多在场
  if (state.energy < 0.4 || state.mood < 0.35) {
    if (drive < 0.45) return "silence";
    return "presence";
  }

  // 有未完线且社交欲够：偏 check_in
  if (opts.hasOpenThread && drive >= 0.4 && rand() < 0.45 + traits.cling * 0.2) {
    return "check_in";
  }

  // 碎嘴度决定 presence vs life
  const lifeThreshold = 0.55 - traits.chatter * 0.35;
  if (drive >= 0.5 && state.mood >= 0.4 && rand() >= lifeThreshold) {
    return "life";
  }

  if (drive >= 0.35) return "presence";
  return "silence";
}

/**
 * 被动回复意图：低精力或高 reserve 且心情一般 → 短回。
 */
export function decideReply(
  state: CompanionState,
  traits: PersonalityTraits = DEFAULT_TRAITS,
): ReplyIntent {
  if (state.crisisResidue >= 0.45) {
    // 沉重时仍要回，但偏短、收着（用 soft 约束长度/语气）
    return "reply_soft";
  }
  const softCut =
    0.38 + traits.reserve * 0.2 - state.energy * 0.15 - state.mood * 0.05;
  if (state.energy < softCut || (state.mood < 0.4 && traits.reserve > 0.5)) {
    return "reply_soft";
  }
  return "reply_normal";
}

/** 被动回复 system 尾指令（含危机残留禁碎念）。 */
export function buildReplyIntentHint(
  replyIntent: ReplyIntent,
  brief: string,
  crisisResidue: number,
): string {
  if (crisisResidue >= 0.45) {
    return `\n本轮回复意图=沉重陪伴短回（内在：${brief}）：只在场陪伴，更短更收着；优先 1 条。禁止日常碎念、场面描写、咖啡/听歌/今日小事等转移话题；不要建议清单。`;
  }
  if (replyIntent === "reply_soft") {
    return `\n本轮回复意图=短回（内在：${brief}）：更短、更收着；优先 1 条，不要拆多泡生活碎念。`;
  }
  return `\n本轮回复意图=正常（内在：${brief}）：按人设自然回即可。`;
}

/** 兼容旧三态：供 generateInitiativeText 分支 */
export function initiativeIntentToTone(
  intent: InitiativeIntent,
): "silence" | "presence" | "life" {
  switch (intent) {
    case "silence":
      return "silence";
    case "life":
    case "check_in":
      return "life";
    case "presence":
    case "heavy_hold":
      return "presence";
  }
}
