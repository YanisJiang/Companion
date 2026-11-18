import { FormEvent, useEffect, useRef, useState } from "react";
import { formatChatTime, shouldShowTime } from "./chatTime";

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
  initiativeDailyCap?: number;
  initiativeUsedToday?: number;
  idleMinMinutes?: number;
  idleMaxMinutes?: number;
  todayState?: string;
  continuityThreads?: string;
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
  const [initiativeDailyCap, setInitiativeDailyCap] = useState(8);
  const [initiativeUsedToday, setInitiativeUsedToday] = useState(0);
  const [idleMinMinutes, setIdleMinMinutes] = useState(3);
  const [idleMaxMinutes, setIdleMaxMinutes] = useState(12);
  const [todayState, setTodayState] = useState("");
  const [continuityThreads, setContinuityThreads] = useState("");
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
      setInitiativeDailyCap(
        typeof res.data.initiativeDailyCap === "number"
          ? res.data.initiativeDailyCap
          : 8,
      );
      setInitiativeUsedToday(
        typeof res.data.initiativeUsedToday === "number"
          ? res.data.initiativeUsedToday
          : 0,
      );
      setIdleMinMinutes(
        typeof res.data.idleMinMinutes === "number"
          ? res.data.idleMinMinutes
          : 3,
      );
      setIdleMaxMinutes(
        typeof res.data.idleMaxMinutes === "number"
          ? res.data.idleMaxMinutes
          : 12,
      );
      setTodayState(res.data.todayState || "");
      setContinuityThreads(res.data.continuityThreads || "");
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
        initiativeDailyCap,
        idleMinMinutes,
        idleMaxMinutes,
      }),
    });
    if (!res.ok) {
      setNotice(res.error);
      return;
    }
    setNotice("设置已保存；建议清空对话后再聊，人设更干净");
    await refreshMe();
  }

  async function regenerateToday() {
    const res = await api<{ ok: boolean; todayState?: string }>("/api/settings", {
      method: "POST",
      body: JSON.stringify({ regenerateTodayState: true }),
    });
    if (!res.ok) {
      setNotice(res.error);
      return;
    }
    setTodayState(res.data.todayState || "");
    setNotice("今日状态已重新生成");
    await refreshMe();
  }

  async function refreshContinuity() {
    const res = await api<{ ok: boolean; continuityThreads?: string }>(
      "/api/settings",
      {
        method: "POST",
        body: JSON.stringify({ refreshContinuityThreads: true }),
      },
    );
    if (!res.ok) {
      setNotice(res.error);
      return;
    }
    setContinuityThreads(res.data.continuityThreads || "");
    setNotice("未完线已刷新");
    await refreshMe();
  }

  async function resetInitiativeUsed() {
    const res = await api<{
      ok: boolean;
      initiativeUsedToday?: number;
      initiativeDailyCap?: number;
    }>("/api/settings", {
      method: "POST",
      body: JSON.stringify({ resetInitiativeUsedToday: true }),
    });
    if (!res.ok) {
      setNotice(res.error);
      return;
    }
    setInitiativeUsedToday(res.data.initiativeUsedToday ?? 0);
    if (typeof res.data.initiativeDailyCap === "number") {
      setInitiativeDailyCap(res.data.initiativeDailyCap);
    }
    setNotice("今日主动已用已清零");
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
            允许主动找我（回后续话 / 安静后找你）
          </label>
          <label>
            每日主动额度（续话+安静找你合计，0～50）
            <input
              type="number"
              min={0}
              max={50}
              value={initiativeDailyCap}
              onChange={(e) =>
                setInitiativeDailyCap(Number(e.target.value) || 0)
              }
            />
          </label>
          <p className="notice" style={{ margin: 0 }}>
            今日已用 {initiativeUsedToday} / {initiativeDailyCap}
          </p>
          <label>
            安静后找你：最短（分钟，1～120）
            <input
              type="number"
              min={1}
              max={120}
              value={idleMinMinutes}
              onChange={(e) =>
                setIdleMinMinutes(Number(e.target.value) || 1)
              }
            />
          </label>
          <label>
            安静后找你：最长（分钟，1～120）
            <input
              type="number"
              min={1}
              max={120}
              value={idleMaxMinutes}
              onChange={(e) =>
                setIdleMaxMinutes(Number(e.target.value) || 1)
              }
            />
          </label>
          <label>
            今日状态（只读，聊天会偶尔引用）
            <textarea
              className="persona-input"
              rows={3}
              value={todayState || "（尚未生成，打开设置或聊一句后会出现）"}
              readOnly
            />
          </label>
          <label>
            近期未完线（只读，可续上）
            <textarea
              className="persona-input"
              rows={4}
              value={
                continuityThreads || "（聊一会儿后刷新，或等自动抽取）"
              }
              readOnly
            />
          </label>
          <div className="settings-row">
            <button className="primary" type="button" onClick={() => void saveSettings()}>
              保存设置
            </button>
            <button className="ghost" type="button" onClick={() => void regenerateToday()}>
              重新生成今日
            </button>
            <button className="ghost" type="button" onClick={() => void refreshContinuity()}>
              刷新未完线
            </button>
            <button className="ghost" type="button" onClick={() => void resetInitiativeUsed()}>
              清零今日已用
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
