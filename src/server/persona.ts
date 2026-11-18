/**
 * 兼容层：人设正文已迁到 config/character/。
 * 此处只再导出，供旧 import 路径与单测使用。
 */
import {
  getCharacterVersion,
  getDossierText,
  getFewShotsText,
  getPersonaText,
} from "./character-config.js";

/** @deprecated 使用 getCharacterVersion()；保留数字字符串兼容旧断言迁移 */
export const PERSONA_SEED_VERSION = getCharacterVersion();

export const DEFAULT_PERSONA = getPersonaText();
export const DEFAULT_DOSSIER = getDossierText();
export const FEW_SHOTS = getFewShotsText();
