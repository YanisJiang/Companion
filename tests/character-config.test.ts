import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getCharacterConfig,
  getDossierText,
  getPersonaText,
  loadCharacterConfig,
} from "../src/server/character-config.ts";

describe("character-config", () => {
  it("从 config/character 加载人设与档案", () => {
    const cfg = loadCharacterConfig(true);
    assert.equal(cfg.version, "10");
    assert.match(cfg.persona, /最多 3 条/);
    assert.match(cfg.persona, /套袜子/);
    assert.match(cfg.dossier, /异地恋/);
    assert.ok(cfg.traits.cling > 0 && cfg.traits.cling <= 1);
    assert.ok(cfg.dynamics.socialRiseBasePerHour > 0);
  });

  it("getter 与 load 一致", () => {
    const cfg = getCharacterConfig();
    assert.equal(getPersonaText(), cfg.persona);
    assert.equal(getDossierText(), cfg.dossier);
  });
});
