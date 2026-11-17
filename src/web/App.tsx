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

export function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const [notice, setNotice] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [companionName, setCompanionName] = useState("阿深");
  const [userNickname, setUserNickname] = useState("你");
  const [proactiveEnabled, setProactiveEnabled] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

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
      setProactiveEnabled(Boolean(res.data.proactiveEnabled));
    }
  }

  async function refreshMessages() {
    const res = await api<{ messages: Message[] }>("/api/messages");
    if (res.ok) setMessages(res.data.messages);
  }

  useEffect(() => {
    void refreshMe();
  }, []);

  useEffect(() => {
    if (!me?.authenticated) return;
    void refreshMessages();
    const t = setInterval(() => {
      void refreshMessages();
    }, 15000);
    return () => clearInterval(t);
  }, [me?.authenticated]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

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
    if (!content || typing) return;
    setDraft("");
    setTyping(true);
    setNotice("");
    const optimistic: Message = {
      id: Date.now(),
      role: "user",
      content,
      is_proactive: 0,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    const res = await api<{
      reply: string;
      messages: Message[];
      notice?: string;
    }>("/api/chat", {
      method: "POST",
      body: JSON.stringify({ content }),
    });
    setTyping(false);
    if (!res.ok) {
      setNotice(res.error);
      await refreshMessages();
      return;
    }
    setMessages(res.data.messages);
    if (res.data.notice) setNotice(res.data.notice);
    await refreshMe();
  }

  async function saveSettings() {
    const res = await api("/api/settings", {
      method: "POST",
      body: JSON.stringify({
        companionName,
        userNickname,
        proactiveEnabled,
      }),
    });
    if (!res.ok) {
      setNotice(res.error);
      return;
    }
    setNotice("设置已保存");
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
          .map((m) => (
            <div
              key={m.id}
              className={`bubble ${m.role}${m.is_proactive ? " proactive" : ""}`}
            >
              {m.content}
            </div>
          ))}
        {typing ? <div className="typing">正在输入…</div> : null}
        <div ref={bottomRef} />
      </div>

      <form className="composer" onSubmit={onSend}>
        <textarea
          value={draft}
          placeholder="说点什么…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void onSend(e as unknown as FormEvent);
            }
          }}
        />
        <button className="primary" type="submit" disabled={typing || !draft.trim()}>
          发送
        </button>
      </form>
    </div>
  );
}
