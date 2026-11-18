# @companion/core

陪伴决策内核：性格 / 快变量 / decide / 节奏 / 危机 / 角色配置 / 编排（收发、idle、主动）。

## 插口

1. **LLM** — `createOpenAiCompatibleLlm({ apiKey, baseUrl, model })` 或自实现 `LlmClient`
2. **MessageStore** — 消息 + 记忆 + settings（含 `KvStore`）；可用 `createMemoryMessageStore()` 或 SQLite 适配
3. **配置目录** — `persona.txt` / `dossier.txt` / `fewshots.txt` / `params.json`  
   示例：`examples/character/`

## 使用（P1）

```ts
import {
  createCompanion,
  createOpenAiCompatibleLlm,
  createMemoryMessageStore,
} from "@companion/core";

const store = createMemoryMessageStore();
const llm = createOpenAiCompatibleLlm({
  apiKey: process.env.API_KEY!,
  baseUrl: "https://api.deepseek.com",
  model: "deepseek-chat",
});

const app = createCompanion({
  llm,
  store,
  configDir: "./config/character",
  onProactiveMessage: (text) => {
    // 可选：宿主推送
    console.log("proactive", text);
  },
});

await app.handleUserMessage("在吗");
app.startProactiveLoop();
```

`createCompanion` 会绑定冷静窗 KV、加载角色配置，并返回 `handleUserMessage` / `startProactiveLoop` 等应用面 API。
