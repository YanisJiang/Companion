import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createCompanion,
  createMemoryMessageStore,
  decideInitiativeTone,
  isHeavyMoodText,
  type ChatMessage,
  type LlmClient,
} from "@companion/core";
import { resolve } from "node:path";

function stubLlm(reply = "嗯"): LlmClient {
  return {
    async chatCompletion(_messages: ChatMessage[]) {
      return reply;
    },
  };
}

describe("createCompanion 编排", () => {
  it("用户句进入 pending，不立刻调 LLM 写助手泡", async () => {
    let calls = 0;
    const llm: LlmClient = {
      async chatCompletion() {
        calls += 1;
        return "回你了";
      },
    };
    const store = createMemoryMessageStore({
      companion_name: "阿深",
      user_nickname: "测",
    });
    const app = createCompanion({
      llm,
      store,
      configDir: resolve(process.cwd(), "config", "character"),
    });

    const result = await app.handleUserMessage("早啊");
    assert.equal(result.pending, true);
    assert.equal(result.reply, "");
    assert.equal(calls, 0);
    assert.ok(store.recentMessages(10).some((m) => m.role === "user"));
  });

  it("危机词后主动 tone 禁 life", () => {
    createCompanion({
      llm: stubLlm(),
      store: createMemoryMessageStore(),
      configDir: resolve(process.cwd(), "config", "character"),
    });
    assert.equal(isHeavyMoodText("我好想死啊"), true);
    for (let i = 0; i < 20; i++) {
      const tone = decideInitiativeTone(["我好想死啊"], () => i / 20);
      assert.notEqual(tone, "life");
    }
  });
});
