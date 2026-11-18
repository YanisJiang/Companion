/**
 * 编排模块用的依赖垫片：统一走 createCompanion 注入的 store / llm / options。
 */
import { getRuntime } from "./context.js";
import type { ChatCompletionOpts, ChatMessage } from "./ports/llm.js";
import type { MemoryRow, MessageRow } from "./ports/store.js";

export type { ChatMessage, MemoryRow, MessageRow };

export function getSetting(key: string): string {
  return getRuntime().store.get(key);
}

export function setSetting(key: string, value: string): void {
  getRuntime().store.set(key, value);
}

export function recentMessages(limit: number): MessageRow[] {
  return getRuntime().store.recentMessages(limit);
}

export function listMessages(limit = 200): MessageRow[] {
  return getRuntime().store.listMessages(limit);
}

export function insertMessage(
  role: "user" | "assistant" | "system",
  content: string,
  isProactive = false,
): MessageRow {
  return getRuntime().store.insertMessage(role, content, isProactive);
}

export function countUserMessages(): number {
  return getRuntime().store.countUserMessages();
}

export function listMemories(): MemoryRow[] {
  return getRuntime().store.listMemories();
}

export function addPin(content: string): MemoryRow {
  return getRuntime().store.addPin(content);
}

export function upsertSummary(content: string): MemoryRow {
  return getRuntime().store.upsertSummary(content);
}

export function clearMemories(): void {
  getRuntime().store.clearMemories();
}

export function clearMessages(): void {
  getRuntime().store.clearMessages();
}

export function hasUserMessageOnLocalDate(dateYmd: string): boolean {
  return getRuntime().store.hasUserMessageOnLocalDate(dateYmd);
}

export function hasProactiveOnLocalDate(dateYmd: string): boolean {
  return getRuntime().store.hasProactiveOnLocalDate(dateYmd);
}

export async function chatCompletion(
  messages: ChatMessage[],
  opts?: ChatCompletionOpts,
): Promise<string> {
  return getRuntime().llm.chatCompletion(messages, opts);
}

/** 兼容旧 config.xxx 读取 */
export const config = {
  get companionName() {
    return getRuntime().options.companionName;
  },
  get userNickname() {
    return getRuntime().options.userNickname;
  },
  get recentTurns() {
    return getRuntime().options.recentTurns;
  },
  get summarizeEveryUserMessages() {
    return getRuntime().options.summarizeEveryUserMessages;
  },
  get proactiveHourStart() {
    return getRuntime().options.proactiveHourStart;
  },
  get proactiveHourEnd() {
    return getRuntime().options.proactiveHourEnd;
  },
};

export function notifyProactivePush(text: string): void {
  const cb = getRuntime().options.onProactiveMessage;
  if (cb) void cb(text);
}
