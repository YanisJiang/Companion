import { initCompanionRuntime, type CompanionOptions } from "./context.js";
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
import { startProactiveLoop, tickProactive } from "./proactive.js";
import {
  isReplyGenerating,
  noteTyping,
  resetReplyScheduler,
  scheduleReplyAfterUserMessage,
} from "./reply-scheduler.js";
import { ensureTodayState } from "./today.js";

export type CompanionApi = {
  handleUserMessage: (raw: string) => Promise<ChatResult>;
  generateProactiveMessage: () => Promise<string>;
  startProactiveLoop: () => ReturnType<typeof setInterval>;
  tickProactive: () => Promise<void>;
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

/** 注入 LLM + MessageStore，初始化编排运行时并返回应用面 API。 */
export function createCompanion(opts: CompanionOptions): CompanionApi {
  initCompanionRuntime(opts);
  return {
    handleUserMessage,
    generateProactiveMessage,
    startProactiveLoop,
    tickProactive,
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
