import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { resolve } from "node:path";
import {
  createCompanion,
  createMemoryMessageStore,
  type LlmClient,
  type ListenHandle,
} from "@yanisjiang/companion-core";

describe("listen 自行启动", () => {
  let handle: ListenHandle | null = null;

  after(async () => {
    if (handle) await handle.close();
  });

  it("health 200；POST 消息进入 pending", async () => {
    let llmCalls = 0;
    const llm: LlmClient = {
      async chatCompletion() {
        llmCalls += 1;
        return "回你";
      },
    };
    const app = createCompanion({
      llm,
      store: createMemoryMessageStore(),
      configDir: resolve(process.cwd(), "config", "character"),
    });
    handle = await app.listen({ port: 0, proactive: false });
    const base = `http://${handle.host}:${handle.port}`;

    const health = await fetch(`${base}/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { ok: true });

    const post = await fetch(`${base}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "早啊" }),
    });
    assert.equal(post.status, 200);
    const body = (await post.json()) as { pending?: boolean; reply?: string };
    assert.equal(body.pending, true);
    assert.equal(body.reply, "");
    assert.equal(llmCalls, 0);

    const list = await fetch(`${base}/messages?limit=10`);
    assert.equal(list.status, 200);
    const listed = (await list.json()) as {
      messages: { role: string; content: string }[];
    };
    assert.ok(listed.messages.some((m) => m.role === "user" && m.content === "早啊"));
  });
});
