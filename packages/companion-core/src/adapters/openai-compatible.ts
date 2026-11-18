import type { ChatCompletionOpts, ChatMessage, LlmClient } from "../ports/llm.js";

export type OpenAiCompatibleLlmOptions = {
  apiKey: string;
  baseUrl: string;
  model: string;
  /** 默认 /v1/chat/completions */
  path?: string;
};

/** OpenAI 兼容 Chat Completions（DeepSeek / 本地 vLLM 等）。 */
export function createOpenAiCompatibleLlm(
  options: OpenAiCompatibleLlmOptions,
): LlmClient {
  const base = options.baseUrl.replace(/\/$/, "");
  const path = options.path ?? "/v1/chat/completions";
  return {
    async chatCompletion(
      messages: ChatMessage[],
      opts?: ChatCompletionOpts,
    ): Promise<string> {
      if (!options.apiKey) {
        throw new Error("未配置 LLM apiKey");
      }
      const res = await fetch(`${base}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${options.apiKey}`,
        },
        body: JSON.stringify({
          model: options.model,
          messages,
          temperature: opts?.temperature ?? 0.9,
          ...(opts?.maxTokens ? { max_tokens: opts.maxTokens } : {}),
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`LLM 请求失败 ${res.status}: ${text.slice(0, 300)}`);
      }
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content?.trim();
      if (!content) throw new Error("LLM 返回空内容");
      return content;
    },
  };
}
