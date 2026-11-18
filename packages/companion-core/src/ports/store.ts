import type { KvStore } from "./kv.js";

export type MessageRow = {
  id: number;
  role: "user" | "assistant" | "system";
  content: string;
  is_proactive: number;
  created_at: string;
};

export type MemoryRow = {
  id: number;
  kind: "summary" | "pin";
  content: string;
  created_at: string;
  updated_at: string;
};

/** 消息 + 记忆 + settings（含 KvStore） */
export type MessageStore = KvStore & {
  recentMessages(limit: number): MessageRow[];
  listMessages(limit?: number): MessageRow[];
  insertMessage(
    role: "user" | "assistant" | "system",
    content: string,
    isProactive?: boolean,
  ): MessageRow;
  countUserMessages(): number;
  listMemories(): MemoryRow[];
  addPin(content: string): MemoryRow;
  upsertSummary(content: string): MemoryRow;
  clearMemories(): void;
  clearMessages(): void;
  hasUserMessageOnLocalDate(dateYmd: string): boolean;
  hasProactiveOnLocalDate(dateYmd: string): boolean;
};
