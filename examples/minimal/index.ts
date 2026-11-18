/**
 * 最小自行启动示例（端口默认 8790）。
 *
 * 用法（在仓库根目录）：
 *   set DEEPSEEK_API_KEY=sk-...
 *   npx tsx examples/minimal/index.ts
 */
import { resolve } from "node:path";
import {
  createCompanion,
  createOpenAiCompatibleLlm,
} from "@companion/core";

const apiKey = process.env.DEEPSEEK_API_KEY || process.env.API_KEY || "";
if (!apiKey) {
  console.error("请设置 DEEPSEEK_API_KEY（或 API_KEY）");
  process.exit(1);
}

const port = Number(process.env.PORT || 8790);
const configDir = resolve(
  process.cwd(),
  process.env.CONFIG_DIR || "packages/companion-core/examples/character",
);

const app = createCompanion({
  llm: createOpenAiCompatibleLlm({
    apiKey,
    baseUrl: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
    model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
  }),
  configDir,
  companionName: process.env.COMPANION_NAME || "阿深",
  userNickname: process.env.USER_NICKNAME || "你",
});

const server = await app.listen({ port, proactive: true });
console.log(
  `[minimal] http://${server.host}:${server.port}  config=${configDir}`,
);
console.log("  GET  /health");
console.log('  POST /messages  {"text":"早啊"}');
console.log("  GET  /messages?limit=50");
