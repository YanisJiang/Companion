/**
 * 角色配置包：人设 / 档案 / few-shot / 五维性格 / 快变量参数。
 * 主源为 config/character/*，不经前端、不以 settings 编辑为准。
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  DEFAULT_TRAITS,
  normalizeTraits,
  type PersonalityTraits,
} from "./traits.js";

export type CharacterDynamics = {
  socialRiseBasePerHour: number;
  socialRiseClingScale: number;
  crisisHalfLifeBaseHours: number;
  crisisHalfLifeSensScale: number;
  initiativeSocialCost: number;
  replyEnergyCost: number;
};

export type StateInitial = {
  energy: number;
  mood: number;
  socialDrive: number;
  crisisResidue: number;
};

export type CharacterParams = {
  version: string;
  traits: PersonalityTraits;
  stateInitial: StateInitial;
  dynamics: CharacterDynamics;
};

export type CharacterConfig = {
  version: string;
  persona: string;
  dossier: string;
  fewShots: string;
  traits: PersonalityTraits;
  stateInitial: CharacterParams["stateInitial"];
  dynamics: CharacterDynamics;
};

const DEFAULT_DYNAMICS: CharacterDynamics = {
  socialRiseBasePerHour: 0.08,
  socialRiseClingScale: 0.14,
  crisisHalfLifeBaseHours: 0.5,
  crisisHalfLifeSensScale: 1.5,
  initiativeSocialCost: 0.35,
  replyEnergyCost: 0.05,
};

const FALLBACK_PERSONA = `你是用户的恋人，在微信私聊。默认超短回复；沉重话题先给情绪；禁止套袜子式延迟借口。单轮最多 3 条。`;
const FALLBACK_DOSSIER = `关系：异地恋。作息：夜猫。习惯：发呆、听歌。`;
const FALLBACK_FEW = `用户：怎么不理我\n你：在呢在呢，刚才没看见`;

let configDirOverride: string | null = null;
let cached: CharacterConfig | null = null;

/** 指定角色配置目录（默认 `cwd/config/character`；example 见 packages/companion-core/examples/character） */
export function setCharacterConfigDir(dir: string): void {
  configDirOverride = dir;
  cached = null;
}

function characterDir(): string {
  return configDirOverride ?? resolve(process.cwd(), "config", "character");
}

function readText(name: string, fallback: string): string {
  const path = resolve(characterDir(), name);
  if (!existsSync(path)) return fallback;
  const text = readFileSync(path, "utf8").trim();
  return text || fallback;
}

function readParams(): CharacterParams {
  const path = resolve(characterDir(), "params.json");
  if (!existsSync(path)) {
    return {
      version: "0",
      traits: DEFAULT_TRAITS,
      stateInitial: {
        energy: 0.7,
        mood: 0.65,
        socialDrive: 0.35,
        crisisResidue: 0,
      },
      dynamics: DEFAULT_DYNAMICS,
    };
  }
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as {
      version?: string;
      traits?: Partial<PersonalityTraits>;
      stateInitial?: Partial<CharacterParams["stateInitial"]>;
      dynamics?: Partial<CharacterDynamics>;
    };
    const traits = normalizeTraits(raw.traits);
    const stateInitial = {
      energy: Number(raw.stateInitial?.energy ?? 0.7),
      mood: Number(raw.stateInitial?.mood ?? 0.65),
      socialDrive: Number(raw.stateInitial?.socialDrive ?? 0.35),
      crisisResidue: Number(raw.stateInitial?.crisisResidue ?? 0),
    };
    const dynamics: CharacterDynamics = {
      ...DEFAULT_DYNAMICS,
      ...(raw.dynamics ?? {}),
    };
    return {
      version: String(raw.version ?? "0"),
      traits,
      stateInitial,
      dynamics,
    };
  } catch {
    return {
      version: "0",
      traits: DEFAULT_TRAITS,
      stateInitial: {
        energy: 0.7,
        mood: 0.65,
        socialDrive: 0.35,
        crisisResidue: 0,
      },
      dynamics: DEFAULT_DYNAMICS,
    };
  }
}

/** 加载（可 force 重读，便于测试） */
export function loadCharacterConfig(force = false): CharacterConfig {
  if (cached && !force) return cached;
  const params = readParams();
  cached = {
    version: params.version,
    persona: readText("persona.txt", FALLBACK_PERSONA),
    dossier: readText("dossier.txt", FALLBACK_DOSSIER),
    fewShots: readText("fewshots.txt", FALLBACK_FEW),
    traits: params.traits,
    stateInitial: params.stateInitial,
    dynamics: params.dynamics,
  };
  return cached;
}

export function getCharacterConfig(): CharacterConfig {
  return loadCharacterConfig(false);
}

export function getPersonaText(): string {
  return getCharacterConfig().persona;
}

export function getDossierText(): string {
  return getCharacterConfig().dossier;
}

export function getFewShotsText(): string {
  return getCharacterConfig().fewShots;
}

export function getConfiguredTraits(): PersonalityTraits {
  return getCharacterConfig().traits;
}

export function getCharacterDynamics(): CharacterDynamics {
  return getCharacterConfig().dynamics;
}

/** 兼容旧测试：配置版本号 */
export function getCharacterVersion(): string {
  return getCharacterConfig().version;
}
