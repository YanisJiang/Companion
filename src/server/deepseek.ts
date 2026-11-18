import { createOpenAiCompatibleLlm, type ChatMessage } from "@companion/core";
import { config } from "./config.js";

export type { ChatMessage };

const llm = createOpenAiCompatibleLlm({
  apiKey: config.deepseekApiKey,
  baseUrl: config.deepseekBaseUrl,
  model: config.deepseekModel,
});

/** 保留给脚本/调试；主路径走 createCompanion 注入的 LlmClient */
export async function chatCompletion(
  messages: ChatMessage[],
  opts?: { temperature?: number; maxTokens?: number },
): Promise<string> {
  return llm.chatCompletion(messages, opts);
}
