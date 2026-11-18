/** LLM 插口：任意 OpenAI 兼容 API 或本地推理服务均可实现。 */

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatCompletionOpts = {
  temperature?: number;
  maxTokens?: number;
};

export type LlmClient = {
  chatCompletion(
    messages: ChatMessage[],
    opts?: ChatCompletionOpts,
  ): Promise<string>;
};
