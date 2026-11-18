import { FormEvent, useEffect, useRef, useState } from "react";

type Message = {
  id: number;
  role: "user" | "assistant" | "system";
  content: string;
  is_proactive: number;
  created_at: string;
};

type Me = {
  authenticated: boolean;
  companionName?: string;
  userNickname?: string;
  persona?: string;
  characterDossier?: string;
  proactiveEnabled?: boolean;
};

async function api<T>(
  path: string,
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; error: string; status: number }> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    credentials: "include",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      error: (data as { error?: string }).error || `请求失败 ${res.status}`,
      status: res.status,
    };
  }
  return { ok: true, data: data as T };
}

const TIME_GAP_MS = 5 * 60 * 1000;
const TZ = "Asia/Shanghai";

/** SQLite datetime('now') 为 UTC 无时区；乐观更新可能是 ISO。 */
function parseMessageTime(raw: string): Date {
  const s = raw.trim();
  if (!s) return new Date(NaN);
  if (/[tT]/.test(s) || /[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) {
    return new Date(s);
  }
  return new Date(`${s.replace(" ", "T")}Z`);
}

function shanghaiYmd(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function formatChatTime(raw: string, now = new Date()): string {
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

function shouldShowTime(prev: Message | undefined, curr: Message): boolean {
  if (!prev) return true;
  const a = parseMessageTime(prev.created_at).getTime();
  const b = parseMessageTime(curr.created_at).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return false;
  return Math.abs(b - a) >= TIME_GAP_MS;
}

export function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [awaitingReply, setAwaitingReply] = useState(false);
  const [showTypingHint, setShowTypingHint] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [companionName, setCompanionName] = useState("阿深");
  const [userNickname, setUserNickname] = useState("你");
  const [persona, setPersona] = useState("");
  const [characterDossier, setCharacterDossier] = useState("");
  const [proactiveEnabled, setProactiveEnabled] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastSendAt = useRef(0);

  async function refreshMe() {
    const res = await api<Me>("/api/me");
    if (!res.ok) {
      setMe({ authenticated: false });
      return;
    }
    setMe(res.data);
    if (res.data.authenticated) {
      setCompanionName(res.data.companionName || "阿深");
      setUserNickname(res.data.userNickname || "你");
      setPersona(res.data.persona || "");
      setCharacterDossier(res.data.characterDossier || "");
      setProactiveEnabled(Boolean(res.data.proactiveEnabled));
    }
  }

  async function refreshMessages() {
    const res = await api<{ messages: Message[] }>("/api/messages");
    if (!res.ok) return;
    setMessages(res.data.messages);
    const list = res.data.messages.filter(
      (m) => m.role === "user" || m.role === "assistant",
    );
    const last = list[list.length - 1];
    if (last?.role === "assistant") setAwaitingReply(false);
    else if (last?.role === "user") setAwaitingReply(true);

    const status = await api<{ generating: boolean }>("/api/reply-status");
    if (status.ok) setShowTypingHint(status.data.generating);
    else if (last?.role === "assistant") setShowTypingHint(false);
  }

  useEffect(() => {
    void refreshMe();
  }, []);

  useEffect(() => {
    if (!me?.authenticated) return;
    void refreshMessages();
    const t = setInterval(() => {
      void refreshMessages();
    }, 2000);
    return () => clearInterval(t);
  }, [me?.authenticated]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, showTypingHint]);

  async function onLogin(e: FormEvent) {
    e.preventDefault();
    setLoginError("");
    const res = await api<{ ok: boolean }>("/api/login", {
      method: "POST",
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      setLoginError(res.error);
      return;
    }
    setPassword("");
    await refreshMe();
  }

  async function onLogout() {
    await api("/api/logout", { method: "POST" });
    setMe({ authenticated: false });
    setMessages([]);
  }

  async function onSend(e: FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if (!content || sending) return;
    setDraft("");
    setSending(true);
    setNotice("");
    lastSendAt.current = Date.now();
    const optimistic: Message = {
      id: Date.now(),
      role: "user",
      content,
      is_proactive: 0,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setAwaitingReply(true);

    const res = await api<{
      reply: string;
      messages: Message[];
      notice?: string;
      pending?: boolean;
    }>("/api/chat", {
      method: "POST",
      body: JSON.stringify({ content }),
    });
    setSending(false);
    if (!res.ok) {
      setNotice(res.error);
      setAwaitingReply(false);
      await refreshMessages();
      return;
    }
    setMessages(res.data.messages);
    if (res.data.notice) setNotice(res.data.notice);
    if (res.data.pending === false) setAwaitingReply(false);
  }

  function onDraftChange(value: string) {
    setDraft(value);
  }

  async function saveSettings() {
    const res = await api("/api/settings", {
      method: "POST",
      body: JSON.stringify({
        companionName,
        userNickname,
        persona,
        characterDossier,
        proactiveEnabled,
      }),
    });
    if (!res.ok) {
      setNotice(res.error);
      return;
    }
    setNotice("设置已保存；建议清空对话后再聊，人设更干净");
    await refreshMe();
  }

  async function clearMemory() {
    await api("/api/memories/clear", { method: "POST" });
    setNotice("记忆已清空");
  }

  async function clearChat() {
    await api("/api/messages/clear", { method: "POST" });
    setMessages([]);
    setNotice("对话已清空");
  }

  if (!me) {
    return (
      <div className="login-wrap">
        <div className="card">加载中…</div>
      </div>
    );
  }

  if (!me.authenticated) {
    return (
      <div className="login-wrap">
        <form className="card" onSubmit={onLogin} style={{ width: "min(420px, 100%)" }}>
          <h1>陪伴</h1>
          <p>私人 AI。输入口令进入。</p>
          <input
            type="password"
            autoComplete="current-password"
            placeholder="口令"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {loginError ? <div className="error">{loginError}</div> : null}
          <button className="primary" type="submit">
            进入
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="topbar">
        <div className="identity">
          <div className="avatar">{(me.companionName || "阿")[0]}</div>
          <div>
            <strong>{me.companionName || "阿深"}</strong>
            <span>在线</span>
          </div>
        </div>
        <div className="settings-row">
          <button className="ghost" type="button" onClick={() => setShowSettings((v) => !v)}>
            设置
          </button>
          <button className="ghost" type="button" onClick={() => void onLogout()}>
            退出
          </button>
        </div>
      </div>

      {showSettings ? (
        <div className="card settings">
          <label>
            AI 显示名
            <input
              type="text"
              value={companionName}
              onChange={(e) => setCompanionName(e.target.value)}
            />
          </label>
          <label>
            怎么称呼你
            <input
              type="text"
              value={userNickname}
              onChange={(e) => setUserNickname(e.target.value)}
            />
          </label>
          <label>
            说话方式 / 人设
            <textarea
              className="persona-input"
              rows={8}
              value={persona}
              onChange={(e) => setPersona(e.target.value)}
              placeholder="描述关系、语气、用词与禁忌…"
            />
          </label>
          <label>
            她是谁 / 小档案
            <textarea
              className="persona-input"
              rows={6}
              value={characterDossier}
              onChange={(e) => setCharacterDossier(e.target.value)}
              placeholder="作息、口味、习惯、脾气…"
            />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={proactiveEnabled}
              onChange={(e) => setProactiveEnabled(e.target.checked)}
            />
            允许每天主动找我一次
          </label>
          <div className="settings-row">
            <button className="primary" type="button" onClick={() => void saveSettings()}>
              保存设置
            </button>
            <button className="ghost" type="button" onClick={() => void clearMemory()}>
              清空记忆
            </button>
            <button className="ghost" type="button" onClick={() => void clearChat()}>
              清空对话
            </button>
          </div>
          <p className="notice" style={{ margin: 0 }}>
            聊天里发送「记住：xxx」可钉住记忆。
          </p>
        </div>
      ) : null}

      {notice ? <p className="notice">{notice}</p> : null}

      <div className="messages">
        {messages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m, index, list) => {
            const prev = index > 0 ? list[index - 1] : undefined;
            const showTime = shouldShowTime(prev, m);
            const timeLabel = showTime ? formatChatTime(m.created_at) : "";
            return (
              <div key={m.id} className="message-block">
                {timeLabel ? <div className="time-divider">{timeLabel}</div> : null}
                <div className={`bubble ${m.role}`}>{m.content}</div>
              </div>
            );
          })}
        {showTypingHint ? <div className="typing">正在输入…</div> : null}
        <div ref={bottomRef} />
      </div>

      <form className="composer" onSubmit={onSend}>
        <textarea
          value={draft}
          placeholder="说点什么…可连发短泡"
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void onSend(e as unknown as FormEvent);
            }
          }}
        />
        <button className="primary" type="submit" disabled={sending || !draft.trim()}>
          发送
        </button>
      </form>
    </div>
  );
}
