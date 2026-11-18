import { bindCrisisStore } from "./crisis.js";
import { setCharacterConfigDir } from "./character-config.js";
import type { LlmClient } from "./ports/llm.js";
import type { MessageStore } from "./ports/store.js";

export type CompanionOptions = {
  llm: LlmClient;
  store: MessageStore;
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
  CompanionOptions;

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
  const options: ResolvedCompanionOptions = {
    ...opts,
    companionName: opts.companionName ?? "阿深",
    userNickname: opts.userNickname ?? "你",
    recentTurns: opts.recentTurns ?? 20,
    summarizeEveryUserMessages: opts.summarizeEveryUserMessages ?? 12,
    proactiveHourStart: opts.proactiveHourStart ?? 21,
    proactiveHourEnd: opts.proactiveHourEnd ?? 22,
  };
  if (opts.configDir) setCharacterConfigDir(opts.configDir);
  bindCrisisStore(opts.store);
  runtime = { llm: opts.llm, store: opts.store, options };
  return options;
}
