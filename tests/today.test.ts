import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatTodayState,
  parseTodayStateJson,
} from "../src/server/today.ts";

describe("parseTodayStateJson", () => {
  it("解析 mood + beats", () => {
    const s = parseTodayStateJson(
      JSON.stringify({ mood: "迷糊", beats: ["听歌", "发呆", "多余"] }),
      "2026-11-18",
    );
    assert.ok(s);
    assert.equal(s!.ymd, "2026-11-18");
    assert.equal(s!.mood, "迷糊");
    assert.deepEqual(s!.beats, ["听歌", "发呆"]);
  });

  it("非法 JSON → null", () => {
    assert.equal(parseTodayStateJson("not-json", "2026-11-18"), null);
  });

  it("空内容 → null", () => {
    assert.equal(
      parseTodayStateJson(JSON.stringify({ mood: "", beats: [] }), "2026-11-18"),
      null,
    );
  });
});

describe("formatTodayState", () => {
  it("格式化为可读短文", () => {
    const text = formatTodayState({
      ymd: "2026-11-18",
      mood: "懒",
      beats: ["刷短视频", "喝咖啡"],
    });
    assert.match(text, /心情：懒/);
    assert.match(text, /刷短视频/);
    assert.match(text, /喝咖啡/);
  });
});
