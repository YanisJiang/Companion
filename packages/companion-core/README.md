# @companion/core

陪伴决策内核：性格 / 快变量 / decide / 节奏 / 危机 / 角色配置 / 编排 / 最小自行启动。

## 插口

1. **LLM** — `createOpenAiCompatibleLlm({ apiKey, baseUrl, model })` 或自实现 `LlmClient`
2. **MessageStore** — 省略则**默认内存**；落盘用 `createSqliteMessageStore({ path })`（需宿主安装 `better-sqlite3`）
3. **配置目录** — `persona.txt` / `dossier.txt` / `fewshots.txt` / `params.json`  
   示例：`examples/character/`

## ① 库调用

```ts
import {
  createCompanion,
  createOpenAiCompatibleLlm,
} from "@companion/core";

const app = createCompanion({
  llm: createOpenAiCompatibleLlm({
    apiKey: process.env.API_KEY!,
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-chat",
  }),
  configDir: "./config/character",
  // store 省略 → 内存；持久化：
  // store: createSqliteMessageStore({ path: "./data/companion.db" }),
});

await app.handleUserMessage("在吗");
await app.tick(); // 主动 / idle / 日程
```

## ② 自行启动（最小 HTTP）

默认端口 **8790**（与现应用 8787 错开）。无鉴权。

```ts
const app = createCompanion({ llm, configDir: "./config/character" });
const server = await app.listen({ port: 8790 });

// GET  /health
// POST /messages  { "text": "早啊" }
// GET  /messages?limit=50
```

完整可跑示例见仓库根目录 `examples/minimal/`。
