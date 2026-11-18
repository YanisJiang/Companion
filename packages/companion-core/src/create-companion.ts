import {
  initCompanionRuntime,
  type CompanionOptions,
  type ResolvedCompanionOptions,
} from "./context.js";
import { createMemoryMessageStore } from "./adapters/memory-store.js";
import {
  generateProactiveMessage,
  handleUserMessage,
  type ChatResult,
} from "./chat.js";
import {
  ensureDaySchedule,
  isClockPingEnabled,
  setClockPingEnabled,
  tickClockEvents,
} from "./clock.js";
import { ensureContinuityThreads } from "./continuity.js";
import { getRuntime } from "./context.js";
import {
  bumpIdleDue,
  cancelPendingFollowup,
  clearIdleDue,
  getIdleWindowMinutes,
  getInitiativeDailyCap,
  getInitiativeUsedToday,
  normalizeIdleWindow,
  resetInitiativeUsedToday,
  setIdleWindowMinutes,
  setInitiativeDailyCap,
  shanghaiYmd,
} from "./followup.js";
import {
  listenCompanion,
  type ListenHandle,
  type ListenOptions,
} from "./listen.js";
import { startProactiveLoop, tickProactive } from "./proactive.js";
import {
  isReplyGenerating,
  noteTyping,
  resetReplyScheduler,
  scheduleReplyAfterUserMessage,
} from "./reply-scheduler.js";
import { ensureTodayState } from "./today.js";
import type { MessageRow, MessageStore } from "./ports/store.js";

export type CompanionApi = {
  options: ResolvedCompanionOptions;
  store: MessageStore;
  handleUserMessage: (raw: string) => Promise<ChatResult>;
  generateProactiveMessage: () => Promise<string>;
  /** 与 tickProactive 相同 */
  tick: () => Promise<void>;
  tickProactive: () => Promise<void>;
  startProactiveLoop: () => ReturnType<typeof setInterval>;
  listen: (opts?: ListenOptions) => Promise<ListenHandle>;
  listMessages: (limit?: number) => MessageRow[];
  ensureTodayState: typeof ensureTodayState;
  ensureDaySchedule: typeof ensureDaySchedule;
  ensureContinuityThreads: typeof ensureContinuityThreads;
  tickClockEvents: typeof tickClockEvents;
  isClockPingEnabled: typeof isClockPingEnabled;
  setClockPingEnabled: typeof setClockPingEnabled;
  getIdleWindowMinutes: typeof getIdleWindowMinutes;
  setIdleWindowMinutes: typeof setIdleWindowMinutes;
  normalizeIdleWindow: typeof normalizeIdleWindow;
  getInitiativeDailyCap: typeof getInitiativeDailyCap;
  setInitiativeDailyCap: typeof setInitiativeDailyCap;
  getInitiativeUsedToday: typeof getInitiativeUsedToday;
  resetInitiativeUsedToday: typeof resetInitiativeUsedToday;
  bumpIdleDue: typeof bumpIdleDue;
  clearIdleDue: typeof clearIdleDue;
  cancelPendingFollowup: typeof cancelPendingFollowup;
  isReplyGenerating: typeof isReplyGenerating;
  noteTyping: typeof noteTyping;
  resetReplyScheduler: typeof resetReplyScheduler;
  scheduleReplyAfterUserMessage: typeof scheduleReplyAfterUserMessage;
  shanghaiYmd: typeof shanghaiYmd;
};

/** 注入 LLM（+ 可选 store），初始化编排运行时并返回应用面 API。 */
export function createCompanion(opts: CompanionOptions): CompanionApi {
  const store = opts.store ?? createMemoryMessageStore();
  const options = initCompanionRuntime({ ...opts, store });
  return {
    options,
    store,
    handleUserMessage,
    generateProactiveMessage,
    tick: tickProactive,
    tickProactive,
    startProactiveLoop,
    listen: (listenOpts) => listenCompanion(listenOpts),
    listMessages: (limit = 200) => getRuntime().store.listMessages(limit),
    ensureTodayState,
    ensureDaySchedule,
    ensureContinuityThreads,
    tickClockEvents,
    isClockPingEnabled,
    setClockPingEnabled,
    getIdleWindowMinutes,
    setIdleWindowMinutes,
    normalizeIdleWindow,
    getInitiativeDailyCap,
    setInitiativeDailyCap,
    getInitiativeUsedToday,
    resetInitiativeUsedToday,
    bumpIdleDue,
    clearIdleDue,
    cancelPendingFollowup,
    isReplyGenerating,
    noteTyping,
    resetReplyScheduler,
    scheduleReplyAfterUserMessage,
    shanghaiYmd,
  };
}
