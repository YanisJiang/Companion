import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeIdleWindow } from "../src/server/followup.ts";

describe("normalizeIdleWindow", () => {
  it("默认范围可原样保留", () => {
    assert.deepEqual(normalizeIdleWindow(3, 12), { min: 3, max: 12 });
  });

  it("min>max 时对调", () => {
    assert.deepEqual(normalizeIdleWindow(15, 5), { min: 5, max: 15 });
  });

  it("夹到 1～120", () => {
    assert.deepEqual(normalizeIdleWindow(0, 999), { min: 1, max: 120 });
  });
});
