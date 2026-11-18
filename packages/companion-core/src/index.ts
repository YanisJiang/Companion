/** @companion/core — 陪伴决策与人设内核（LLM / 配置 / KV 可插拔） */

export type {
  ChatCompletionOpts,
  ChatMessage,
  LlmClient,
} from "./ports/llm.js";
export type { KvStore } from "./ports/kv.js";
export { createMemoryKv } from "./ports/kv.js";

export { createOpenAiCompatibleLlm } from "./adapters/openai-compatible.js";
export type { OpenAiCompatibleLlmOptions } from "./adapters/openai-compatible.js";

export {
  clamp01,
  DEFAULT_TRAITS,
  normalizeTraits,
  type PersonalityTraits,
} from "./traits.js";

export {
  createInitialState,
  energyBaselineForHour,
  onInitiativeSentState,
  onReplySentState,
  onUserMessageState,
  parseCompanionState,
  serializeCompanionState,
  STATE_SETTINGS_KEY,
  tickState,
  type CompanionState,
} from "./companion-state.js";

export {
  decideInitiative,
  decideReply,
  initiativeIntentToTone,
  type DecideInitiativeOpts,
  type InitiativeIntent,
  type Intent,
  type ReplyIntent,
} from "./decide.js";

export {
  coalesceShortBubbles,
  isNudge,
  MAX_BUBBLES,
  MIN_BUBBLE_CHARS,
  QUIET_MANY_MAX_MS,
  QUIET_MANY_MIN_MS,
  QUIET_MAX_MS,
  QUIET_MIN_MS,
  quietDelayMs,
  shouldReplyImmediately,
  splitBubbles,
} from "./rhythm.js";

export {
  getCharacterConfig,
  getCharacterDynamics,
  getCharacterVersion,
  getConfiguredTraits,
  getDossierText,
  getFewShotsText,
  getPersonaText,
  loadCharacterConfig,
  setCharacterConfigDir,
  type CharacterConfig,
  type CharacterDynamics,
  type CharacterParams,
  type StateInitial,
} from "./character-config.js";

export {
  bindCrisisStore,
  bumpHeavyCooldown,
  getHeavyUntil,
  HEAVY_COOLDOWN_MS,
  isHeavyMoodText,
  isInHeavyCooldown,
  noteUserTextForCrisis,
  textsHaveHeavyMood,
} from "./crisis.js";
