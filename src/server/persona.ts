/**
 * 兼容层：人设正文在 config/character/，由 @yanisjiang/companion-core 加载。
 */
import {
  getCharacterVersion,
  getDossierText,
  getFewShotsText,
  getPersonaText,
} from "@yanisjiang/companion-core";

export const PERSONA_SEED_VERSION = getCharacterVersion();
export const DEFAULT_PERSONA = getPersonaText();
export const DEFAULT_DOSSIER = getDossierText();
export const FEW_SHOTS = getFewShotsText();
