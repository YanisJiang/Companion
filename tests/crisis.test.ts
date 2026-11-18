import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  HEAVY_COOLDOWN_MS,
  isHeavyMoodText,
  textsHaveHeavyMood,
} from "../src/server/crisis.ts";

describe("isHeavyMoodText", () => {
  it("命中危机/重情绪", () => {
    for (const t of [
      "我好想死啊",
      "重度抑郁那么久了",
      "重度焦虑",
      "没人关心我",
      "没人在乎",
      "活不下去了",
    ]) {
      assert.equal(isHeavyMoodText(t), true, t);
    }
  });

  it("普通难受不算", () => {
    for (const t of ["我好难受啊", "我好累啊", "没钱了", "早啊"]) {
      assert.equal(isHeavyMoodText(t), false, t);
    }
  });
});

describe("textsHaveHeavyMood", () => {
  it("列表任一命中即可", () => {
    assert.equal(textsHaveHeavyMood(["累了", "我好想死啊"]), true);
    assert.equal(textsHaveHeavyMood(["累了", "困了"]), false);
  });
});

describe("HEAVY_COOLDOWN_MS", () => {
  it("冷静窗约 45 分钟", () => {
    assert.equal(HEAVY_COOLDOWN_MS, 45 * 60_000);
  });
});
