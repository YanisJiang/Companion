import "./bootstrap.js";

export {
  canAttemptInitiative,
  canAttemptWithStreak,
  clearUnansweredInitiativeStreak,
  decideInitiativeIntent,
  decideInitiativeTone,
  effectiveUnansweredStreak,
  getUnansweredInitiativeStreak,
  isSoftHeavyText,
  noteUnansweredInitiative,
  overlayStateForInitiative,
  recentUserTexts,
  shanghaiYmdLocal,
  UNANSWERED_STREAK_CAP,
  type InitiativeTone,
} from "@yanisjiang/companion-core";
