import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createInitialState,
  energyBaselineForHour,
  onInitiativeSentState,
  parseCompanionState,
  serializeCompanionState,
  tickState,
  type CompanionState,
} from "../src/server/companion-state.ts";
import {
  decideInitiative,
  decideReply,
  initiativeIntentToTone,
} from "../src/server/decide.ts";
import {
  DEFAULT_TRAITS,
  normalizeTraits,
  type PersonalityTraits,
} from "../src/server/traits.ts";

function state(partial: Partial<CompanionState>): CompanionState {
  return { ...createInitialState(1_000), ...partial, updatedAt: 1_000 };
}

describe("traits", () => {
  it("默认五维在 0～1", () => {
    for (const v of Object.values(DEFAULT_TRAITS)) {
      assert.ok(v >= 0 && v <= 1);
    }
  });

  it("normalize 会 clamp", () => {
    const t = normalizeTraits({ cling: 2, chatter: -1 });
    assert.equal(t.cling, 1);
    assert.equal(t.chatter, 0);
  });
});

describe("tickState", () => {
  it("高 cling 安静后 socialDrive 涨更快", () => {
    const base = state({ socialDrive: 0.2, energy: 0.7, mood: 0.6, crisisResidue: 0 });
    const lowCling: PersonalityTraits = { ...DEFAULT_TRAITS, cling: 0.2 };
    const highCling: PersonalityTraits = { ...DEFAULT_TRAITS, cling: 0.9 };
    const dt = 60 * 60_000;
    const a = tickState(base, lowCling, dt, 21, 1_000 + dt);
    const b = tickState(base, highCling, dt, 21, 1_000 + dt);
    assert.ok(b.socialDrive > a.socialDrive);
  });

  it("危机残留随时间衰减；敏感高衰减更慢", () => {
    const base = state({ crisisResidue: 1 });
    const lowSens = { ...DEFAULT_TRAITS, heavySensitivity: 0.2 };
    const highSens = { ...DEFAULT_TRAITS, heavySensitivity: 0.95 };
    const dt = 2 * 60 * 60_000;
    const a = tickState(base, lowSens, dt, 15, 1_000 + dt);
    const b = tickState(base, highSens, dt, 15, 1_000 + dt);
    assert.ok(a.crisisResidue < 1);
    assert.ok(b.crisisResidue > a.crisisResidue);
  });

  it("夜猫 chronotype 晚间精力基线更高", () => {
    const nightOwl = energyBaselineForHour(23, 0.9);
    const earlyBird = energyBaselineForHour(23, 0.1);
    assert.ok(nightOwl > earlyBird);
  });
});

describe("decideInitiative", () => {
  it("crisisResidue 高 → 禁止 life / check_in", () => {
    const s = state({ crisisResidue: 0.8, socialDrive: 0.9, energy: 0.9, mood: 0.7 });
    for (let i = 0; i < 30; i++) {
      const intent = decideInitiative(s, DEFAULT_TRAITS, {
        rand: () => i / 30,
        hasOpenThread: true,
      });
      assert.notEqual(intent, "life");
      assert.notEqual(intent, "check_in");
    }
  });

  it("同状态高 chatter 更易 life", () => {
    const s = state({
      crisisResidue: 0,
      socialDrive: 0.75,
      energy: 0.8,
      mood: 0.7,
    });
    const quiet = { ...DEFAULT_TRAITS, chatter: 0.15 };
    const chatty = { ...DEFAULT_TRAITS, chatter: 0.95 };
    let lifeQuiet = 0;
    let lifeChatty = 0;
    for (let i = 0; i < 40; i++) {
      const r = () => (i + 0.5) / 40;
      if (decideInitiative(s, quiet, { rand: r }) === "life") lifeQuiet++;
      if (decideInitiative(s, chatty, { rand: r }) === "life") lifeChatty++;
    }
    assert.ok(lifeChatty > lifeQuiet);
  });

  it("socialDrive 低 → silence", () => {
    const s = state({
      socialDrive: 0.1,
      energy: 0.8,
      mood: 0.7,
      crisisResidue: 0,
    });
    assert.equal(decideInitiative(s, DEFAULT_TRAITS, { rand: () => 0.5 }), "silence");
  });

  it("intent→tone：heavy_hold→presence，check_in→life", () => {
    assert.equal(initiativeIntentToTone("heavy_hold"), "presence");
    assert.equal(initiativeIntentToTone("check_in"), "life");
    assert.equal(initiativeIntentToTone("silence"), "silence");
  });
});

describe("decideReply", () => {
  it("低精力 → reply_soft", () => {
    const s = state({ energy: 0.2, mood: 0.5, crisisResidue: 0 });
    assert.equal(decideReply(s, DEFAULT_TRAITS), "reply_soft");
  });

  it("精力好且无危机 → reply_normal", () => {
    const s = state({ energy: 0.85, mood: 0.7, crisisResidue: 0 });
    assert.equal(decideReply(s, { ...DEFAULT_TRAITS, reserve: 0.3 }), "reply_normal");
  });
});

describe("serialize", () => {
  it("round-trip", () => {
    const s = state({ energy: 0.42, mood: 0.33, socialDrive: 0.61, crisisResidue: 0.2 });
    const again = parseCompanionState(serializeCompanionState(s), 2_000);
    assert.ok(again);
    assert.equal(again!.energy, 0.42);
    assert.equal(again!.mood, 0.33);
    assert.equal(again!.socialDrive, 0.61);
    assert.equal(again!.crisisResidue, 0.2);
  });

  it("主动发出扣 socialDrive", () => {
    const s = state({ socialDrive: 0.8 });
    const next = onInitiativeSentState(s, 2_000);
    assert.ok(next.socialDrive < s.socialDrive);
  });
});
