# @companion/core

陪伴决策内核：性格 / 快变量 / decide / 节奏 / 危机 / 角色配置。

## 两个插口

1. **LLM** — `createOpenAiCompatibleLlm({ apiKey, baseUrl, model })` 或自实现 `LlmClient`
2. **配置** — 目录含 `persona.txt` / `dossier.txt` / `fewshots.txt` / `params.json`  
   示例：`examples/character/`（与本仓库根目录 `config/character` 同结构）

另需宿主提供 **KvStore**（冷静窗等）：`bindCrisisStore(store)`。

## 使用

```ts
import {
  createOpenAiCompatibleLlm,
  setCharacterConfigDir,
  bindCrisisStore,
  createMemoryKv,
  decideInitiative,
  loadCharacterConfig,
} from "@companion/core";

setCharacterConfigDir("./config/character"); // 或 examples/character
bindCrisisStore(createMemoryKv()); // 生产可换成 SQLite settings

const llm = createOpenAiCompatibleLlm({
  apiKey: process.env.API_KEY!,
  baseUrl: "https://api.deepseek.com",
  model: "deepseek-chat",
});

const cfg = loadCharacterConfig(true);
```

P0 仅导出纯逻辑与端口；完整 `handleUserMessage` / 自行启动见后续版本。
