import { FormEvent, useEffect, useRef, useState } from "react";
import { formatChatTime, shouldShowTime } from "./chatTime";
import {
  ensureNotificationPermission,
  maybeLocalNotifyProactive,
  subscribeWebPush,
  unsubscribeWebPush,
} from "./notify";

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
  clockPingEnabled?: boolean;
  pushNotifyEnabled?: boolean;
  pushConfigured?: boolean;
  initiativeDailyCap?: number;
  initiativeUsedToday?: number;
  idleMinMinutes?: number;
  idleMaxMinutes?: number;
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
  const [proactiveEnabled, setProactiveEnabled] = useState(true);
  const [clockPingEnabled, setClockPingEnabled] = useState(true);
  const [pushNotifyEnabled, setPushNotifyEnabled] = useState(false);
  const [pushConfigured, setPushConfigured] = useState(false);
  const [initiativeDailyCap, setInitiativeDailyCap] = useState(8);
  const [initiativeUsedToday, setInitiativeUsedToday] = useState(0);
  const [idleMinMinutes, setIdleMinMinutes] = useState(3);
  const [idleMaxMinutes, setIdleMaxMinutes] = useState(12);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  /** 仅在贴近底部或刚发送时跟随滚底 */
  const stickToBottom = useRef(true);
  const lastSendAt = useRef(0);
  const pushNotifyEnabledRef = useRef(false);

  useEffect(() => {
    if (!showSettings) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowSettings(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showSettings]);

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
      setClockPingEnabled(res.data.clockPingEnabled !== false);
      setPushNotifyEnabled(Boolean(res.data.pushNotifyEnabled));
      pushNotifyEnabledRef.current = Boolean(res.data.pushNotifyEnabled);
      setPushConfigured(Boolean(res.data.pushConfigured));
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
    if (pushNotifyEnabledRef.current && last) maybeLocalNotifyProactive(last);

    const status = await api<{ generating: boolean }>("/api/reply-status");
    if (status.ok) setShowTypingHint(status.data.generating);
    else if (last?.role === "assistant") setShowTypingHint(false);
  }

  async function enableSystemPush(): Promise<boolean> {
    const allowed = await ensureNotificationPermission();
    if (!allowed) {
      setNotice("浏览器拒绝了通知权限");
      return false;
    }
    const vapid = await api<{ publicKey: string; configured: boolean }>(
      "/api/push/vapid-public",
    );
    if (!vapid.ok) {
      setNotice(vapid.error || "服务器未配置推送密钥（需 HTTPS + VAPID）");
      return false;
    }
    if (!vapid.data.publicKey) {
      setNotice("服务器未配置推送密钥（需 HTTPS + VAPID）");
      return false;
    }
    try {
      const sub = await subscribeWebPush(vapid.data.publicKey);
      if (!sub) {
        setNotice("当前环境不支持 Web Push（需 HTTPS 或 localhost）");
        return false;
      }
      const res = await api("/api/push/subscribe", {
        method: "POST",
        body: JSON.stringify({ enabled: true, subscription: sub }),
      });
      if (!res.ok) {
        setNotice(res.error);
        return false;
      }
      setPushNotifyEnabled(true);
      pushNotifyEnabledRef.current = true;
      setPushConfigured(true);
      return true;
    } catch (err) {
      setNotice(
        err instanceof Error
          ? err.message
          : "订阅推送失败（HTTP 站点通常不行，需 HTTPS）",
      );
      return false;
    }
  }

  async function disableSystemPush(): Promise<void> {
    try {
      await unsubscribeWebPush();
    } catch {
      /* ignore */
    }
    await api("/api/push/subscribe", {
      method: "POST",
      body: JSON.stringify({ enabled: false, subscription: null }),
    });
    setPushNotifyEnabled(false);
    pushNotifyEnabledRef.current = false;
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

  function isNearBottom(el: HTMLDivElement, px = 80): boolean {
    return el.scrollHeight - el.scrollTop - el.clientHeight <= px;
  }

  useEffect(() => {
    // 设置打开时绝不自动滚，避免整页被拽走、关不掉设置
    if (showSettings) return;
    const box = messagesRef.current;
    if (!box) return;
    if (!stickToBottom.current && !isNearBottom(box)) return;
    stickToBottom.current = true;
    // 只滚消息容器，不用 scrollIntoView（会带动页面滚走顶栏/设置）
    box.scrollTop = box.scrollHeight;
  }, [messages, showTypingHint, showSettings]);

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
    stickToBottom.current = true;
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
        proactiveEnabled,
        clockPingEnabled,
        initiativeDailyCap,
        idleMinMinutes,
        idleMaxMinutes,
      }),
    });
    if (!res.ok) {
      setNotice(res.error);
      return;
    }
    setNotice("设置已保存");
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
        <div
          className="settings-overlay"
          role="presentation"
          onClick={() => setShowSettings(false)}
        >
          <div
            className="card settings settings-panel"
            role="dialog"
            aria-modal="true"
            aria-label="设置"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="settings-panel-head">
              <strong>设置</strong>
              <button
                className="ghost"
                type="button"
                onClick={() => setShowSettings(false)}
              >
                关闭
              </button>
            </div>
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
              允许主动找我（回后续话 / 安静后找你）
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={clockPingEnabled}
                onChange={(e) => setClockPingEnabled(e.target.checked)}
              />
              允许事件到点找我（生活时钟）
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={pushNotifyEnabled}
                onChange={(e) => {
                  const on = e.target.checked;
                  void (async () => {
                    if (on) {
                      const ok = await enableSystemPush();
                      if (!ok) setPushNotifyEnabled(false);
                    } else {
                      await disableSystemPush();
                    }
                  })();
                }}
              />
              系统通知（主动消息推送）
            </label>
            {!pushConfigured ? (
              <p className="notice" style={{ margin: 0 }}>
                推送需服务器配置 VAPID，且网站最好是 HTTPS；页在后台时也会尝试本地通知。
              </p>
            ) : null}
            <label>
              每日主动额度（续话+安静找你+事件找你合计，0～50）
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
            <div className="settings-row">
              <button className="primary" type="button" onClick={() => void saveSettings()}>
                保存设置
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
              聊天里发送「记住：xxx」可钉住记忆。点遮罩或 Esc 关闭。
            </p>
          </div>
        </div>
      ) : null}

      {notice ? <p className="notice">{notice}</p> : null}

      <div
        className="messages"
        ref={messagesRef}
        onScroll={() => {
          const box = messagesRef.current;
          if (!box) return;
          stickToBottom.current = isNearBottom(box);
        }}
      >
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
