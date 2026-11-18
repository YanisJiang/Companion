import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  TIME_GAP_MS,
  parseMessageTime,
  shouldShowTime,
} from "../src/web/chatTime.ts";

describe("parseMessageTime", () => {
  it("SQLite UTC 无时区按 UTC 解析", () => {
    const d = parseMessageTime("2026-11-18 01:00:00");
    assert.equal(d.toISOString(), "2026-11-18T01:00:00.000Z");
  });

  it("ISO 带 Z", () => {
    const d = parseMessageTime("2026-11-18T01:00:00.000Z");
    assert.equal(d.toISOString(), "2026-11-18T01:00:00.000Z");
  });
});

describe("shouldShowTime", () => {
  it("首条必显", () => {
    assert.equal(
      shouldShowTime(undefined, { created_at: "2026-11-18 01:00:00" }),
      true,
    );
  });

  it("assistant→assistant 隔 ≥3 分钟要显（含主动）", () => {
    const prev = {
      role: "assistant",
      created_at: "2026-11-18 01:00:00",
      is_proactive: 0,
    };
    const curr = {
      role: "assistant",
      created_at: "2026-11-18 01:03:00",
      is_proactive: 1,
    };
    assert.equal(shouldShowTime(prev, curr), true);
    assert.equal(TIME_GAP_MS, 3 * 60 * 1000);
  });

  it("几秒内连泡不显", () => {
    assert.equal(
      shouldShowTime(
        { role: "assistant", created_at: "2026-11-18 01:00:00" },
        { role: "assistant", created_at: "2026-11-18 01:00:02" },
      ),
      false,
    );
  });

  it("user→assistant 隔久也显", () => {
    assert.equal(
      shouldShowTime(
        { role: "user", created_at: "2026-11-18 01:00:00" },
        { role: "assistant", created_at: "2026-11-18 01:05:00" },
      ),
      true,
    );
  });
});
