import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatContinuity,
  parseContinuityJson,
} from "../src/server/continuity.ts";

describe("parseContinuityJson", () => {
  it("解析并截断到 4 条", () => {
    const s = parseContinuityJson(
      JSON.stringify({
        threads: ["晚上沙茶面", "还饿着", "烦工作", "约了散步", "多余"],
      }),
      "2026-11-18",
      12,
    );
    assert.ok(s);
    assert.equal(s!.threads.length, 4);
    assert.equal(s!.threads[0], "晚上沙茶面");
    assert.equal(s!.userMsgAtExtract, 12);
  });

  it("非法 JSON → null", () => {
    assert.equal(parseContinuityJson("x", "2026-11-18"), null);
  });
});

describe("formatContinuity", () => {
  it("空线程 → 空串", () => {
    assert.equal(
      formatContinuity({ ymd: "2026-11-18", threads: [], userMsgAtExtract: 0 }),
      "",
    );
  });

  it("格式化为编号列表", () => {
    const text = formatContinuity({
      ymd: "2026-11-18",
      threads: ["沙茶面", "赖床"],
      userMsgAtExtract: 1,
    });
    assert.match(text, /1\. 沙茶面/);
    assert.match(text, /2\. 赖床/);
  });
});
