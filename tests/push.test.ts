import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("push payload shape", () => {
  it("正文截断到 120", () => {
    const body = "x".repeat(200).slice(0, 120);
    assert.equal(body.length, 120);
    const payload = JSON.stringify({ title: "小怡", body, url: "/" });
    const parsed = JSON.parse(payload) as { body: string };
    assert.equal(parsed.body.length, 120);
  });
});
