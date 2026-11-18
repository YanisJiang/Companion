# 陪伴节奏第一期 Implementation Plan

> **For agentic workers:** 按任务顺序落地；用户回 do 后再改代码。

**Goal:** 打破一来一回问答感：多泡、回后续话、安静后偶发主动找你。

**Architecture:** 聊天回复拆泡入库；进程内 setTimeout 排续话；proactive loop 增加「安静找你」分支；persona seed v4；前端略加快轮询以便看到续话。

**Tech Stack:** 现有 Hono + SQLite + DeepSeek + React。

## Global Constraints

- 单轮 assistant ≤3 泡；每日非用户触发 ≤4
- 不做生活状态机 / 推送 / 已读不回
- 最小改动；打回退标签；先 Plan 再 do

---

### Task 1: persona v4

- Modify: `src/server/persona.ts`
- seed=4；规则+few-shot：连发、自带生活碎片、少问句收尾、续话/主动范例

### Task 2: 拆泡 + 续话调度

- Modify: `src/server/chat.ts`
- Create: `src/server/followup.ts`（队列、今日计数、概率/延迟、生成续话）
- `handleUserMessage`：拆 `---` → 多条 `insertMessage`；按概率 `scheduleFollowup`
- Modify: `src/server/db.ts`：今日 proactive/followup 计数 helpers（或 settings 键）

### Task 3: 安静找你（轻 B）

- Modify: `src/server/proactive.ts`
- 在现有每日问候外：若今日已聊、距上次用户消息 3～12 分钟、未超日上限 → 发 1 条短主动

### Task 4: 前端轮询

- Modify: `src/web/App.tsx`
- 已登录轮询 15s → 5s（便于看到续话）

### Task 5: 部署与回退点

- 部署阿里云；验证 seed=4；打 `conv-living-phase1-*` 标签
