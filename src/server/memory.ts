import { config } from "./config.js";
import { chatCompletion } from "./deepseek.js";
import {
  countUserMessages,
  listMemories,
  recentMessages,
  upsertSummary,
} from "./db.js";

export function buildMemoryBlock(): string {
  const memories = listMemories();
  const pins = memories.filter((m) => m.kind === "pin").map((m) => `- ${m.content}`);
  const summary = memories.find((m) => m.kind === "summary")?.content;

  const parts: string[] = [];
  if (summary) parts.push(`长期摘要：\n${summary}`);
  if (pins.length) parts.push(`用户钉住的记忆：\n${pins.join("\n")}`);
  return parts.join("\n\n");
}

export async function maybeRefreshSummary() {
  const userCount = countUserMessages();
  if (
    userCount === 0 ||
    userCount % config.summarizeEveryUserMessages !== 0
  ) {
    return;
  }

  const recent = recentMessages(40);
  if (recent.length < 6) return;

  const transcript = recent
    .map((m) => `${m.role === "user" ? "用户" : "助手"}: ${m.content}`)
    .join("\n");

  const existing = listMemories().find((m) => m.kind === "summary")?.content ?? "";

  try {
    const content = await chatCompletion([
      {
        role: "system",
        content:
          "你是记忆整理器。根据对话整理简洁中文摘要，保留对陪伴有用的稳定事实、偏好、约定与近况。不要写废话，控制在 300 字内。",
      },
      {
        role: "user",
        content: `已有摘要：\n${existing || "（无）"}\n\n最近对话：\n${transcript}\n\n请输出更新后的摘要正文，不要标题。`,
      },
    ]);
    upsertSummary(content);
  } catch (err) {
    console.error("[memory] 摘要失败", err);
  }
}
