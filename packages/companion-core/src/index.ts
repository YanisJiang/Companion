/** @yanisjiang/companion-core — 陪伴决策与人设内核（LLM / 配置 / 存储可插拔） */

export type {
  ChatCompletionOpts,
  ChatMessage,
  LlmClient,
} from "./ports/llm.js";
export type { KvStore } from "./ports/kv.js";
export { createMemoryKv } from "./ports/kv.js";
export type { MemoryRow, MessageRow, MessageStore } from "./ports/store.js";

export { createOpenAiCompatibleLlm } from "./adapters/openai-compatible.js";
export type { OpenAiCompatibleLlmOptions } from "./adapters/openai-compatible.js";
export { createMemoryMessageStore } from "./adapters/memory-store.js";
export {
  createSqliteMessageStore,
  type SqliteMessageStoreOptions,
} from "./adapters/sqlite-store.js";

export type { CompanionOptions, ResolvedCompanionOptions } from "./context.js";
export { isCompanionReady } from "./context.js";
export { createCompanion, type CompanionApi } from "./create-companion.js";
export {
  listenCompanion,
  type ListenHandle,
  type ListenOptions,
} from "./listen.js";

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
  buildReplyIntentHint,
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

export {
  applyInitiativeSentToCompanionState,
  applyReplySentToCompanionState,
  applyUserMessageToCompanionState,
  ensureCompanionStateTicked,
  formatStateBrief,
  getTraits,
  loadCompanionState,
  saveCompanionState,
} from "./companion-runtime.js";

export {
  canAttemptInitiative,
  canAttemptWithStreak,
  clearUnansweredInitiativeStreak,
  decideInitiativeIntent,
  decideInitiativeTone,
  effectiveUnansweredStreak,
  getUnansweredInitiativeStreak,
  isSoftHeavyText,
  noteUnansweredInitiative,
  overlayStateForInitiative,
  recentUserTexts,
  shanghaiYmdLocal,
  UNANSWERED_STREAK_CAP,
  type InitiativeTone,
} from "./initiative-context.js";

export {
  bumpIdleDue,
  bumpIdleDueAfterCrisisSilence,
  bumpIdleDueAfterUnanswered,
  canSendInitiative,
  cancelPendingFollowup,
  clearIdleDue,
  generateInitiativeText,
  getIdleWindowMinutes,
  getInitiativeDailyCap,
  getInitiativeUsedToday,
  idleDueMsAfterHeavy,
  normalizeIdleWindow,
  recordInitiative,
  resetInitiativeUsedToday,
  scheduleFollowupAfterReply,
  scheduleIdleAfterHeavyCooldown,
  setIdleWindowMinutes,
  setInitiativeDailyCap,
  shanghaiYmd,
  tickIdlePing,
} from "./followup.js";

export { startProactiveLoop, tickProactive } from "./proactive.js";

export {
  cancelScheduledReply,
  isReplyGenerating,
  noteTyping,
  resetReplyScheduler,
  scheduleReplyAfterUserMessage,
} from "./reply-scheduler.js";

export {
  generateProactiveMessage,
  handleUserMessage,
  type ChatResult,
} from "./chat.js";

export { buildSystemPrompt } from "./prompt.js";
export { buildMemoryBlock, maybeRefreshSummary } from "./memory.js";

export {
  formatTodayState,
  ensureTodayState,
  getTodayStateText,
  parseTodayStateJson,
  readStoredTodayState,
  type TodayState,
} from "./today.js";

export {
  formatContinuity,
  ensureContinuityThreads,
  getContinuityText,
  parseContinuityJson,
  readStoredContinuity,
  type ContinuityState,
} from "./continuity.js";

export {
  advanceDueEvents,
  ensureDaySchedule,
  formatSchedule,
  getScheduleText,
  isClockPingEnabled,
  parseScheduleJson,
  readStoredSchedule,
  setClockPingEnabled,
  shanghaiParts,
  tickClockEvents,
  type ScheduleEvent,
} from "./clock.js";
