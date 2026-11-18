import { chatCompletion, type ChatMessage } from "./deepseek.js";
import { config } from "./config.js";
import { insertMessage, recentMessages } from "./db.js";
import {
  cancelPendingFollowup,
  scheduleFollowupAfterReply,
} from "./followup.js";
import { maybeRefreshSummary } from "./memory.js";
import { buildSystemPrompt } from "./prompt.js";
import {
  MAX_BUBBLES,
  isNudge,
  quietDelayMs,
  splitBubbles as splitBubblesPure,
} from "./rhythm.js";
import { ensureContinuityThreads } from "./continuity.js";
import { ensureTodayState } from "./today.js";

const BUBBLE_GAP_MIN_MS = 500;
const BUBBLE_GAP_MAX_MS = 2_400;

let replyGen = 0;
let quietTimer: ReturnType<typeof setTimeout> | null = null;
let generating = false;
let pendingRerun = false;

function randBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function splitBubbles(text: string): string[] {
  return splitBubblesPure(text);
}

export function isReplyGenerating(): boolean {
  return generating;
}

export function cancelScheduledReply(): void {
  replyGen += 1;
  if (quietTimer) {
    clearTimeout(quietTimer);
    quietTimer = null;
  }
}

function trailingUserTexts(): string[] {
  const recent = recentMessages(30);
  const pending: string[] = [];
  for (let i = recent.length - 1; i >= 0; i--) {
    const m = recent[i];
    if (m.role === "user") pending.push(m.content);
    else break;
  }
  return pending.reverse();
}

function lastMessageNeedsReply(): boolean {
  return trailingUserTexts().length > 0;
}

function armQuietThenReply(gen: number): void {
  if (quietTimer) {
    clearTimeout(quietTimer);
    quietTimer = null;
  }
  const pending = trailingUserTexts();
  if (!pending.length) return;

  const wait = quietDelayMs(pending);
  quietTimer = setTimeout(() => {
    quietTimer = null;
    void generateReply(gen);
  }, wait);
}

/**
 * 确定性回合：连发只重置安静窗；停发一小会儿必回。
 * 不使用 LLM 回/听决策，也不看输入框。
 */
export function scheduleReplyAfterUserMessage(_textLen = 0): void {
  cancelPendingFollowup();
  cancelScheduledReply();
  if (generating) {
    pendingRerun = true;
    return;
  }
  armQuietThenReply(replyGen);
}

async function generateReply(gen: number): Promise<void> {
  if (gen !== replyGen) return;
  if (generating) {
    pendingRerun = true;
    return;
  }
  if (!lastMessageNeedsReply()) return;

  const pending = trailingUserTexts();
  console.log("[reply-scheduler] reply", {
    pending: pending.length,
    nudge: isNudge(pending[pending.length - 1] ?? ""),
  });

  const genAtStart = replyGen;
  generating = true;
  try {
    await generateAndInsertReply(genAtStart);
  } catch (err) {
    console.error("[reply-scheduler]", err);
    if (genAtStart === replyGen) {
      insertMessage("assistant", "模型超时或出错了，请再发一次。");
    }
  } finally {
    generating = false;
    if (pendingRerun) {
      pendingRerun = false;
      if (lastMessageNeedsReply()) armQuietThenReply(replyGen);
    }
  }
}

async function generateAndInsertReply(genAtStart: number): Promise<void> {
  await ensureTodayState();
  await ensureContinuityThreads();
  const history = recentMessages(config.recentTurns * 2);
  const messages: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt() },
    ...history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  const reply = await chatCompletion(messages);
  if (genAtStart !== replyGen) return;

  const bubbles = splitBubbles(reply).slice(0, MAX_BUBBLES);
  if (!bubbles.length) return;

  insertMessage("assistant", bubbles[0]);

  let chainDelay = 0;
  for (let i = 1; i < bubbles.length; i++) {
    const gap = randBetween(BUBBLE_GAP_MIN_MS, BUBBLE_GAP_MAX_MS);
    chainDelay += gap;
    const text = bubbles[i];
    setTimeout(() => {
      if (genAtStart !== replyGen) return;
      insertMessage("assistant", text);
    }, chainDelay);
  }

  setTimeout(() => {
    if (genAtStart !== replyGen) return;
    scheduleFollowupAfterReply();
  }, chainDelay + 50);

  void maybeRefreshSummary();
}

export function resetReplyScheduler(): void {
  cancelScheduledReply();
  generating = false;
  pendingRerun = false;
}

/** 兼容旧 /api/typing；不再参与调度。 */
export function noteTyping(_isTyping: boolean): void {
  // no-op
}
