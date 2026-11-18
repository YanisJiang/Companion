import { resolve } from "node:path";
import {
  createCompanion,
  createOpenAiCompatibleLlm,
  type MessageStore,
} from "@yanisjiang/companion-core";
import { config } from "./config.js";
import {
  addPin,
  clearMemories,
  clearMessages,
  countUserMessages,
  getSetting,
  hasProactiveOnLocalDate,
  hasUserMessageOnLocalDate,
  insertMessage,
  listMemories,
  listMessages,
  recentMessages,
  setSetting,
  upsertSummary,
} from "./db.js";
import { notifyProactivePush } from "./push.js";

const sqliteStore: MessageStore = {
  get: getSetting,
  set: setSetting,
  recentMessages,
  listMessages,
  insertMessage,
  countUserMessages,
  listMemories,
  addPin,
  upsertSummary,
  clearMemories,
  clearMessages,
  hasUserMessageOnLocalDate,
  hasProactiveOnLocalDate,
};

const llm = createOpenAiCompatibleLlm({
  apiKey: config.deepseekApiKey,
  baseUrl: config.deepseekBaseUrl,
  model: config.deepseekModel,
});

/** 应用启动时注入端口；HTTP 层仍可直接用 db.getSetting */
export const companion = createCompanion({
  llm,
  store: sqliteStore,
  configDir: resolve(process.cwd(), "config", "character"),
  companionName: config.companionName,
  userNickname: config.userNickname,
  recentTurns: config.recentTurns,
  summarizeEveryUserMessages: config.summarizeEveryUserMessages,
  proactiveHourStart: config.proactiveHourStart,
  proactiveHourEnd: config.proactiveHourEnd,
  onProactiveMessage: (text) => {
    void notifyProactivePush(text);
  },
});
