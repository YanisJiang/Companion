import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canAttemptWithStreak,
  decideInitiativeTone,
  effectiveUnansweredStreak,
  UNANSWERED_STREAK_CAP,
} from "../src/server/initiative-context.ts";

describe("decideInitiativeTone", () => {
  it("危机词 → 禁止 life", () => {
    for (let i = 0; i < 20; i++) {
      const tone = decideInitiativeTone(["我好想死啊"], () => i / 20);
      assert.notEqual(tone, "life");
    }
  });

  it("软沉重 → 禁止 life", () => {
    for (let i = 0; i < 20; i++) {
      const tone = decideInitiativeTone(["我好难受啊", "好累"], () => i / 20);
      assert.notEqual(tone, "life");
    }
  });

  it("平常闲聊 → life", () => {
    assert.equal(decideInitiativeTone(["早啊", "吃饭了吗"], () => 0.5), "life");
  });
});

describe("unanswered streak", () => {
  it("跨日视为 0", () => {
    assert.equal(effectiveUnansweredStreak(2, "2026-11-17", "2026-11-18"), 0);
    assert.equal(effectiveUnansweredStreak(1, "2026-11-18", "2026-11-18"), 1);
  });

  it("streak < cap 可主动，≥cap 不可", () => {
    assert.equal(UNANSWERED_STREAK_CAP, 2);
    assert.equal(canAttemptWithStreak(0), true);
    assert.equal(canAttemptWithStreak(1), true);
    assert.equal(canAttemptWithStreak(2), false);
  });
});
