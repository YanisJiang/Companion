/** 聊天时间显示纯逻辑（可单测）。 */

export const TIME_GAP_MS = 3 * 60 * 1000;
export const TZ = "Asia/Shanghai";

/** SQLite datetime('now') 为 UTC 无时区；乐观更新可能是 ISO。 */
export function parseMessageTime(raw: string): Date {
  const s = raw.trim();
  if (!s) return new Date(NaN);
  if (/[tT]/.test(s) || /[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) {
    return new Date(s);
  }
  return new Date(`${s.replace(" ", "T")}Z`);
}

export function shanghaiYmd(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function formatChatTime(raw: string, now = new Date()): string {
  const d = parseMessageTime(raw);
  if (Number.isNaN(d.getTime())) return "";

  const hm = new Intl.DateTimeFormat("zh-CN", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);

  const day = shanghaiYmd(d);
  const today = shanghaiYmd(now);
  const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterday = shanghaiYmd(yesterdayDate);

  if (day === today) return hm;
  if (day === yesterday) return `昨天 ${hm}`;

  const year = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
  }).format(d);
  const thisYear = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
  }).format(now);

  if (year === thisYear) {
    const md = new Intl.DateTimeFormat("zh-CN", {
      timeZone: TZ,
      month: "numeric",
      day: "numeric",
    }).format(d);
    return `${md} ${hm}`;
  }

  const full = new Intl.DateTimeFormat("zh-CN", {
    timeZone: TZ,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).format(d);
  return `${full} ${hm}`;
}

export type TimeMsg = {
  created_at: string;
  role?: string;
  is_proactive?: number;
};

/**
 * 任意角色：与上一条间隔够久就显示时间。
 * 含她主动/续话（assistant→assistant）。
 * 阈值 3 分钟，与安静找你下限对齐。
 */
export function shouldShowTime(
  prev: TimeMsg | undefined,
  curr: TimeMsg,
  gapMs = TIME_GAP_MS,
): boolean {
  if (!prev) return true;
  const a = parseMessageTime(prev.created_at).getTime();
  const b = parseMessageTime(curr.created_at).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return false;
  return Math.abs(b - a) >= gapMs;
}
