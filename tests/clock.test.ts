import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  advanceDueEvents,
  formatSchedule,
  parseScheduleJson,
  type ScheduleEvent,
} from "../src/server/clock.ts";

describe("parseScheduleJson", () => {
  it("解析并按时间排序、截断到 5", () => {
    const raw = JSON.stringify({
      events: [
        { hour: 18, minute: 0, label: "晚饭" },
        { hour: 9, minute: 30, label: "起床" },
        { hour: 12, minute: 0, label: "午饭" },
        { hour: 15, minute: 0, label: "发呆" },
        { hour: 21, minute: 0, label: "躺着" },
        { hour: 22, minute: 0, label: "多余" },
      ],
    });
    const events = parseScheduleJson(raw, "2026-11-18");
    assert.ok(events);
    assert.equal(events!.length, 5);
    assert.equal(events![0].label, "起床");
    assert.equal(events![0].hour, 9);
  });

  it("非法 JSON → null", () => {
    assert.equal(parseScheduleJson("{", "2026-11-18"), null);
  });
});

describe("advanceDueEvents", () => {
  const base: ScheduleEvent[] = [
    { hour: 9, minute: 0, label: "早", fired: false, pinged: false },
    { hour: 15, minute: 30, label: "午后", fired: false, pinged: false },
  ];

  it("未到点不 fired", () => {
    const { newlyFired, events } = advanceDueEvents(base, 8, 59);
    assert.equal(newlyFired.length, 0);
    assert.equal(events[0].fired, false);
  });

  it("到点标记 fired", () => {
    const { newlyFired, events } = advanceDueEvents(base, 9, 0);
    assert.equal(newlyFired.length, 1);
    assert.equal(newlyFired[0].label, "早");
    assert.equal(events[0].fired, true);
    assert.equal(events[1].fired, false);
  });

  it("已 fired 不再进 newlyFired", () => {
    const already = base.map((e, i) =>
      i === 0 ? { ...e, fired: true } : e,
    );
    const { newlyFired } = advanceDueEvents(already, 16, 0);
    assert.equal(newlyFired.length, 1);
    assert.equal(newlyFired[0].label, "午后");
  });
});

describe("formatSchedule", () => {
  it("带已发生/计划中标记", () => {
    const text = formatSchedule(
      [
        { hour: 9, minute: 5, label: "醒", fired: true, pinged: true },
        { hour: 20, minute: 0, label: "晚饭", fired: false, pinged: false },
      ],
      "2026-11-18",
    );
    assert.match(text, /09:05 醒（已发生）/);
    assert.match(text, /20:00 晚饭（计划中）/);
  });
});
