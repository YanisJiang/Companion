# @yanisjiang/companion-core

陪伴决策**内核库**：性格五维 × 快变量 → `decide` 意图 → 你接入的 LLM 只负责把意图写成话。

本包**不是**完整聊天网站，也不负责口令登录、PWA、Web Push、Nginx/pm2 等部署。那些在仓库里的 **Companion Web 宿主应用**。

## Install

```bash
npm i @yanisjiang/companion-core
```

可选持久化（SQLite）：

```bash
npm i better-sqlite3
```

## 插口

1. **LLM** — `createOpenAiCompatibleLlm({ apiKey, baseUrl, model })` 或自实现 `LlmClient`
2. **MessageStore** — 省略则**默认内存**；落盘：`createSqliteMessageStore({ path })`（需 `better-sqlite3`）
3. **角色配置目录** — `persona.txt` / `dossier.txt` / `fewshots.txt` / `params.json`  
   示例见包内 `examples/character/`

## 库调用

```ts
import {
  createCompanion,
  createOpenAiCompatibleLlm,
} from "@yanisjiang/companion-core";

const app = createCompanion({
  llm: createOpenAiCompatibleLlm({
    apiKey: process.env.API_KEY!,
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-chat",
  }),
  configDir: "./character",
  // store 省略 → 内存
  // store: createSqliteMessageStore({ path: "./data/companion.db" }),
});

await app.handleUserMessage("在吗");
await app.tick(); // idle / 主动 / 日程等
```

把 `app` 接到你自己的 HTTP、机器人、桌面壳即可；**7×24 常驻与推送由宿主负责**。

## 可选：`listen`（薄 HTTP，非产品部署）

仅方便本地试收发，默认端口 **8790**，无鉴权。正式上线请用你自己的服务框架。

```ts
const server = await app.listen({ port: 8790 });
// GET /health  POST /messages  GET /messages
```

## 仓库

完整自托管 Web/PWA 示例与部署说明：  
https://github.com/YanisJiang/Companion

## License

MIT
