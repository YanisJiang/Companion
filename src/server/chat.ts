import {
  addPin,
  insertMessage,
  recentMessages,
  type MessageRow,
} from "./db.js";
import { bumpIdleDue, cancelPendingFollowup } from "./followup.js";
import { chatCompletion, type ChatMessage } from "./deepseek.js";
import { buildSystemPrompt } from "./prompt.js";
import {
  resetReplyScheduler,
  scheduleReplyAfterUserMessage,
} from "./reply-scheduler.js";
import { ensureTodayState } from "./today.js";

function detectPin(text: string): string | null {
  const m = text.trim().match(/^记住[:：]\s*(.+)$/s);
  return m?.[1]?.trim() ? m[1].trim() : null;
}

export type ChatResult = {
  reply: string;
  messages: MessageRow[];
  notice?: string;
  pending?: boolean;
};

/** 写入用户消息并调度回复（不立刻调模型）。 */
export async function handleUserMessage(raw: string): Promise<ChatResult> {
  const text = raw.trim();
  if (!text) throw new Error("消息不能为空");

  cancelPendingFollowup();

  const pin = detectPin(text);
  if (pin) {
    addPin(pin);
    insertMessage("user", text);
    const reply = `记住了：${pin}`;
    insertMessage("assistant", reply);
    bumpIdleDue();
    resetReplyScheduler();
    return {
      reply,
      messages: recentMessages(200),
      notice: "已写入钉住记忆",
      pending: false,
    };
  }

  insertMessage("user", text);
  bumpIdleDue();
  scheduleReplyAfterUserMessage(text.length);

  return {
    reply: "",
    messages: recentMessages(200),
    pending: true,
  };
}

export async function generateProactiveMessage(): Promise<string> {
  await ensureTodayState();
  const messages: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt() },
    {
      role: "user",
      content:
        "（系统）今天用户还没来找你。请发一句很短的主动问候，像恋人私聊随口说一句，可轻轻带一点「你今天的状态」或小档案细节，不要提问收尾，不要列表，不要讲道理。",
    },
  ];
  return chatCompletion(messages);
}
