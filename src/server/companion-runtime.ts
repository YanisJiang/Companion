import {
  getCharacterDynamics,
  getCharacterConfig,
  getConfiguredTraits,
} from "./character-config.js";
import {
  createInitialState,
  onInitiativeSentState,
  onReplySentState,
  onUserMessageState,
  parseCompanionState,
  serializeCompanionState,
  STATE_SETTINGS_KEY,
  tickState,
  type CompanionState,
} from "./companion-state.js";
import { getSetting, setSetting } from "./db.js";
import type { PersonalityTraits } from "./traits.js";

function shanghaiHour(d = new Date()): number {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    hour: "numeric",
    hour12: false,
  }).format(d);
  return Number(hour);
}

/** 性格来自配置文件 */
export function getTraits(): PersonalityTraits {
  return getConfiguredTraits();
}

export function loadCompanionState(now = Date.now()): CompanionState {
  const parsed = parseCompanionState(getSetting(STATE_SETTINGS_KEY) || "", now);
  if (parsed) return parsed;
  const seed = getCharacterConfig().stateInitial;
  return createInitialState(now, seed);
}

export function saveCompanionState(state: CompanionState): void {
  setSetting(STATE_SETTINGS_KEY, serializeCompanionState(state));
}

/** 按距上次 updatedAt 推进并写回 */
export function ensureCompanionStateTicked(now = Date.now()): CompanionState {
  const prev = loadCompanionState(now);
  const dt = Math.max(0, now - (prev.updatedAt || now));
  const next = tickState(
    prev,
    getTraits(),
    dt,
    shanghaiHour(new Date(now)),
    now,
    getCharacterDynamics(),
  );
  saveCompanionState(next);
  return next;
}

export function applyUserMessageToCompanionState(opts: {
  heavy?: boolean;
  softHeavy?: boolean;
  now?: number;
}): CompanionState {
  const now = opts.now ?? Date.now();
  const ticked = ensureCompanionStateTicked(now);
  const next = onUserMessageState(ticked, opts);
  saveCompanionState(next);
  return next;
}

export function applyInitiativeSentToCompanionState(now = Date.now()): CompanionState {
  const ticked = ensureCompanionStateTicked(now);
  const next = onInitiativeSentState(ticked, now, getCharacterDynamics());
  saveCompanionState(next);
  return next;
}

export function applyReplySentToCompanionState(now = Date.now()): CompanionState {
  const ticked = ensureCompanionStateTicked(now);
  const next = onReplySentState(ticked, now, getCharacterDynamics());
  saveCompanionState(next);
  return next;
}

export function formatStateBrief(state: CompanionState): string {
  const pct = (n: number) => Math.round(clampPct(n) * 100);
  return `精力${pct(state.energy)} 心情${pct(state.mood)} 社交欲${pct(state.socialDrive)} 危机残留${pct(state.crisisResidue)}`;
}

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
