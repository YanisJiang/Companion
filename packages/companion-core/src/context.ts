import { bindCrisisStore } from "./crisis.js";
import { setCharacterConfigDir } from "./character-config.js";
import type { LlmClient } from "./ports/llm.js";
import type { MessageStore } from "./ports/store.js";

export type CompanionOptions = {
  llm: LlmClient;
  /**
   * 消息/记忆/settings 存储。
   * 省略时默认内存 `createMemoryMessageStore()`（进程内；要落盘用 createSqliteMessageStore）。
   */
  store?: MessageStore;
  /** 默认 cwd/config/character */
  configDir?: string;
  companionName?: string;
  userNickname?: string;
  recentTurns?: number;
  summarizeEveryUserMessages?: number;
  proactiveHourStart?: number;
  proactiveHourEnd?: number;
  /** 主动消息发出后回调（宿主可接推送） */
  onProactiveMessage?: (text: string) => void | Promise<void>;
};

export type ResolvedCompanionOptions = Required<
  Pick<
    CompanionOptions,
    | "companionName"
    | "userNickname"
    | "recentTurns"
    | "summarizeEveryUserMessages"
    | "proactiveHourStart"
    | "proactiveHourEnd"
  >
> &
  Omit<CompanionOptions, "store"> & { store: MessageStore };

let runtime: {
  llm: LlmClient;
  store: MessageStore;
  options: ResolvedCompanionOptions;
} | null = null;

export function getRuntime() {
  if (!runtime) {
    throw new Error("请先调用 createCompanion(...) 初始化内核");
  }
  return runtime;
}

export function isCompanionReady(): boolean {
  return runtime !== null;
}

export function initCompanionRuntime(opts: CompanionOptions): ResolvedCompanionOptions {
  if (!opts.store) {
    throw new Error("initCompanionRuntime 需要 store；请用 createCompanion（可省略 store）");
  }
  const store = opts.store;
  const options: ResolvedCompanionOptions = {
    ...opts,
    store,
    companionName: opts.companionName ?? "阿深",
    userNickname: opts.userNickname ?? "你",
    recentTurns: opts.recentTurns ?? 20,
    summarizeEveryUserMessages: opts.summarizeEveryUserMessages ?? 12,
    proactiveHourStart: opts.proactiveHourStart ?? 21,
    proactiveHourEnd: opts.proactiveHourEnd ?? 22,
  };
  if (opts.configDir) setCharacterConfigDir(opts.configDir);
  bindCrisisStore(store);
  runtime = { llm: opts.llm, store, options };
  return options;
}
