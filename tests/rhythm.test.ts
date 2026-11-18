import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_PERSONA,
  PERSONA_SEED_VERSION,
} from "../src/server/persona.ts";
import {
  QUIET_MANY_MAX_MS,
  QUIET_MANY_MIN_MS,
  QUIET_MAX_MS,
  QUIET_MIN_MS,
  isNudge,
  quietDelayMs,
  shouldReplyImmediately,
  splitBubbles,
} from "../src/server/rhythm.ts";

describe("isNudge", () => {
  it("识别催促 / 喊人", () => {
    for (const t of [
      "怎么不理我",
      "理我",
      "在吗",
      "回我一下",
      "说话啊",
      "理一下",
      "喂",
      "?",
      "？",
    ]) {
      assert.equal(isNudge(t), true, t);
    }
  });

  it("普通闲聊不算催促", () => {
    for (const t of ["早啊", "吃饭了吗", "起床了吗", "袜子怎么样", "好吧"]) {
      assert.equal(isNudge(t), false, t);
    }
  });
});

describe("quietDelayMs", () => {
  it("催促 → 立刻回（0）", () => {
    assert.equal(quietDelayMs(["吃饭了吗", "怎么不理我"], () => 0.5), 0);
    assert.equal(quietDelayMs(["喂"], () => 0.99), 0);
  });

  it("1～2 条普通消息 → 落在 1.5～3s", () => {
    for (const r of [0, 0.5, 1]) {
      const d = quietDelayMs(["早啊"], () => Math.min(r, 0.999));
      assert.ok(d >= QUIET_MIN_MS && d <= QUIET_MAX_MS, `d=${d} r=${r}`);
    }
    const d2 = quietDelayMs(["早啊", "吃饭了吗"], () => 0.5);
    assert.ok(d2 >= QUIET_MIN_MS && d2 <= QUIET_MAX_MS);
  });

  it("≥3 条未回 → 稍短窗 1.2～2s", () => {
    const pending = ["早啊", "起床了吗", "吃饭了吗"];
    for (const r of [0, 0.5, 0.999]) {
      const d = quietDelayMs(pending, () => r);
      assert.ok(
        d >= QUIET_MANY_MIN_MS && d <= QUIET_MANY_MAX_MS,
        `d=${d} r=${r}`,
      );
    }
  });

  it("连发重置语义：同一 pending 每次重算，不依赖上次", () => {
    const a = quietDelayMs(["嗨"], () => 0);
    const b = quietDelayMs(["嗨", "吃饭了吗"], () => 0);
    assert.equal(a, QUIET_MIN_MS);
    assert.equal(b, QUIET_MIN_MS);
  });
});

describe("shouldReplyImmediately", () => {
  it("末条催促才立刻回", () => {
    assert.equal(shouldReplyImmediately(["早啊", "吃饭了吗"]), false);
    assert.equal(shouldReplyImmediately(["早啊", "怎么不理我"]), true);
    assert.equal(shouldReplyImmediately([]), false);
  });
});

describe("splitBubbles", () => {
  it("按 --- 拆泡", () => {
    assert.deepEqual(splitBubbles("早啊…\n---\n眼还糊着"), [
      "早啊…",
      "眼还糊着",
    ]);
  });

  it("最多保留 5 条", () => {
    const text = [1, 2, 3, 4, 5, 6].map((n) => `泡${n}`).join("\n---\n");
    assert.equal(splitBubbles(text).length, 5);
    assert.equal(splitBubbles(text)[4], "泡5");
  });

  it("空内容 → 空数组", () => {
    assert.deepEqual(splitBubbles("   "), []);
  });
});

describe("persona delay-excuse ban", () => {
  it("seed=8 且禁止用忙碌圆沉默", () => {
    assert.equal(PERSONA_SEED_VERSION, "8");
    assert.match(DEFAULT_PERSONA, /套袜子/);
    assert.match(DEFAULT_PERSONA, /禁止用/);
    assert.match(DEFAULT_PERSONA, /不理/);
  });
});
