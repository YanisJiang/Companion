import type { MemoryRow, MessageRow, MessageStore } from "../ports/store.js";

function shanghaiYmd(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function ymdOfIso(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  return shanghaiYmd(new Date(t));
}

/** 内存 MessageStore：单测 / 无 SQLite 宿主用 */
export function createMemoryMessageStore(
  initial: Record<string, string> = {},
): MessageStore {
  const settings = new Map<string, string>(Object.entries(initial));
  const messages: MessageRow[] = [];
  const memories: MemoryRow[] = [];
  let nextMsgId = 1;
  let nextMemId = 1;

  return {
    get(key) {
      return settings.get(key) ?? "";
    },
    set(key, value) {
      settings.set(key, value);
    },
    recentMessages(limit) {
      return messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .slice(-limit);
    },
    listMessages(limit = 200) {
      return messages.slice(-limit);
    },
    insertMessage(role, content, isProactive = false) {
      const row: MessageRow = {
        id: nextMsgId++,
        role,
        content,
        is_proactive: isProactive ? 1 : 0,
        created_at: new Date().toISOString(),
      };
      messages.push(row);
      return row;
    },
    countUserMessages() {
      return messages.filter((m) => m.role === "user").length;
    },
    listMemories() {
      return [...memories];
    },
    addPin(content) {
      const now = new Date().toISOString();
      const row: MemoryRow = {
        id: nextMemId++,
        kind: "pin",
        content,
        created_at: now,
        updated_at: now,
      };
      memories.push(row);
      return row;
    },
    upsertSummary(content) {
      const existing = memories.find((m) => m.kind === "summary");
      const now = new Date().toISOString();
      if (existing) {
        existing.content = content;
        existing.updated_at = now;
        return existing;
      }
      const row: MemoryRow = {
        id: nextMemId++,
        kind: "summary",
        content,
        created_at: now,
        updated_at: now,
      };
      memories.push(row);
      return row;
    },
    clearMemories() {
      memories.length = 0;
    },
    clearMessages() {
      messages.length = 0;
    },
    hasUserMessageOnLocalDate(dateYmd) {
      return messages.some(
        (m) => m.role === "user" && ymdOfIso(m.created_at) === dateYmd,
      );
    },
    hasProactiveOnLocalDate(dateYmd) {
      return messages.some(
        (m) => m.is_proactive === 1 && ymdOfIso(m.created_at) === dateYmd,
      );
    },
  };
}
